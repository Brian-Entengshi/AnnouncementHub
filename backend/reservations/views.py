from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from config.api import ResourceViewSet
from audit_logs.models import AuditLog
from config.permissions import manager
from .models import Reservation
from .serializers import ReservationSerializer
from .services import approve_booking, record_status, local_instant


class ReservationViewSet(ResourceViewSet):
    queryset = Reservation.objects.select_related(
        "venue", "requester", "team"
    ).prefetch_related("history__actor")
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["title", "venue__name", "venue_snapshot"]
    http_method_names = ["get", "post", "head", "options"]
    exact_filters = ("status", "venue_id", "date")

    def get_queryset(self):
        query = super().get_queryset()
        if self.action == "list" and self.request.query_params.get("for_event") == "1":
            query = query.filter(
                status="approved", venue__archived=False, venue__available=True
            )
        if (
            not manager(self.request.user)
            or self.request.query_params.get("mine") == "1"
        ):
            return query.filter(requester=self.request.user)
        return query

    def perform_create(self, serializer):
        reservation = serializer.save(requester=self.request.user)
        record_status(reservation, self.request.user)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def transition(self, request, pk=None):
        reservation = self.get_object()
        target = request.data.get("status")
        allowed = {
            "pending": ["approved", "rejected", "cancelled"],
            "approved": ["completed", "cancelled"],
        }
        if target not in allowed.get(reservation.status, []):
            raise serializers.ValidationError(
                "This status change is no longer available."
            )
        if not manager(request.user) and target != "cancelled":
            return Response(
                {"detail": "Approval requires an officer or adviser."}, status=403
            )
        reason = str(request.data.get("reason", "")).strip()
        if target == "rejected" and not reason:
            raise serializers.ValidationError(
                {"reason": "Enter the reason for rejection."}
            )
        if target == "approved":
            approve_booking(reservation, request.user, reason)
            return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)
        if (
            target == "completed"
            and local_instant(reservation.date, reservation.end) > timezone.now()
        ):
            raise serializers.ValidationError(
                "A booking can be completed after its end time."
            )
        reservation.status = target
        reservation.save(update_fields=["status"])
        record_status(reservation, request.user, reason)
        if target == "cancelled" and (event := getattr(reservation, "event", None)):
            AuditLog.record(request.user, "Cancelled", event)
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)
