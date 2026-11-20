from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from config.api import ResourceViewSet
from config.filters import filter_date_range
from audit_logs.models import AuditLog
from config.permissions import IsManager, adviser, manager
from .models import Reservation
from .serializers import ReservationSerializer
from .services import approve_booking, record_status, local_instant


class ReservationViewSet(ResourceViewSet):
    queryset = Reservation.objects.select_related(
        "venue", "requester", "team"
    ).prefetch_related("history__actor")
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = [
        "title",
        "description",
        "venue__name",
        "venue_snapshot",
        "requester__first_name",
        "requester__username",
        "team__name",
    ]
    http_method_names = ["get", "post", "head", "options"]
    exact_filters = ("status", "venue_id", "date", "team_id")

    def get_permissions(self):
        if self.action == "create":
            return [IsManager()]
        return super().get_permissions()

    def get_queryset(self):
        query = super().get_queryset()
        if self.action == "list":
            query = filter_date_range(query, self.request.query_params, "date")
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
        actor = self.request.user
        automatic = adviser(actor)
        reservation = serializer.save(
            requester=actor, status="approved" if automatic else "pending"
        )
        if automatic:
            AuditLog.record(actor, "Submitted", reservation)
        record_status(reservation, actor, automatic=automatic)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def transition(self, request, pk=None):
        visible = self.get_object()
        reservation = Reservation.objects.select_for_update().get(pk=visible.pk)
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
        if (
            target in ("approved", "rejected")
            and request.user.pk == reservation.requester_id
            and not adviser(request.user)
        ):
            raise PermissionDenied("Another reviewer must decide your reservation.")
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
