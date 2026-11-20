from datetime import date, timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models.deletion import ProtectedError
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.api import ResourceViewSet
from audit_logs.models import AuditLog
from config.permissions import IsAdviser, manager
from notifications.models import Notification
from reservations.models import Reservation
from .models import Venue, Notice
from .serializers import VenueSerializer, NoticeSerializer


class VenueViewSet(ResourceViewSet):
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    search_fields = ["name", "location", "description"]

    def get_permissions(self):
        if self.action in ("create", "destroy", "archive"):
            return [IsAdviser()]
        return super().get_permissions()

    def get_queryset(self):
        venues = super().get_queryset()
        if self.action in (
            "retrieve",
            "update",
            "partial_update",
            "destroy",
            "archive",
        ):
            return venues
        params = self.request.query_params
        if manager(self.request.user) and params.get("bookable") != "1":
            status = params.get("status")
            if status == "archived" or params.get("archived") == "1":
                return venues.filter(archived=True)
            if status == "inactive":
                return venues.filter(archived=False, available=False)
        return venues.filter(archived=False, available=True)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        venue = self.get_object()
        try:
            with transaction.atomic():
                self.perform_destroy(venue)
        except ProtectedError:
            return Response(
                {
                    "detail": "This venue has linked reservations or notices. Archive it to preserve those records."
                },
                status=409,
            )
        return Response({"detail": "Venue deleted successfully."})

    def perform_destroy(self, instance):
        AuditLog.record(self.request.user, "Deleted", instance)
        instance.delete()

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def archive(self, request, pk=None):
        venue = self.get_object()
        if venue.archived:
            return Response({"detail": "This venue is already archived."})
        venue.archived = True
        venue.available = False
        venue.save(update_fields=["archived", "available"])
        AuditLog.record(request.user, "Archived", venue)
        return Response(
            {"detail": "Venue archived. Existing reservations and notices were kept."}
        )

    def perform_update(self, serializer):
        was_available = serializer.instance.available
        super().perform_update(serializer)
        if was_available != serializer.instance.available:
            action_name = (
                "Reactivated" if serializer.instance.available else "Deactivated"
            )
            AuditLog.record(self.request.user, action_name, serializer.instance)


class NoticeViewSet(ResourceViewSet):
    queryset = Notice.objects.select_related("venue")
    serializer_class = NoticeSerializer
    search_fields = ["title", "description", "venue__name", "venue_snapshot"]
    exact_filters = ("venue_id",)

    def get_queryset(self):
        query = super().get_queryset()
        if self.action == "retrieve":
            return query
        query = query.filter(venue__isnull=False)
        if self.action == "list":
            now = timezone.now()
            statuses = {
                "current": {"starts_at__lte": now, "ends_at__gt": now},
                "upcoming": {"starts_at__gt": now},
                "expired": {"ends_at__lte": now},
            }
            query = query.filter(
                **statuses.get(self.request.query_params.get("status"), {})
            )
        if (
            manager(self.request.user)
            and self.request.query_params.get("manage") == "1"
        ):
            return query
        return query.filter(ends_at__gt=timezone.now(), venue__archived=False)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        Notification.broadcast(
            serializer.instance.title, f"/venue-notices/{serializer.instance.pk}"
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def availability(request):
    try:
        start = date.fromisoformat(
            request.query_params.get("from", str(timezone.localdate()))
        )
        end = date.fromisoformat(
            request.query_params.get("to", str(start + timedelta(days=6)))
        )
        if not 0 <= (end - start).days <= 42:
            raise ValueError()
        venue_id = int(request.query_params.get("venue") or 0)
    except ValueError:
        return Response(
            {"detail": "Choose a valid venue and a range of up to 43 days."}, status=400
        )
    query = Reservation.objects.filter(
        date__range=(start, end), venue__isnull=False
    ).select_related("venue", "event")
    visible = ["approved", "completed"]
    if manager(request.user):
        visible.append("pending")
    from django.db.models import Q

    scope = Q(status__in=visible)
    if request.user.is_authenticated:
        scope |= Q(requester=request.user, status="pending")
    query = query.filter(scope)
    notices = Notice.objects.filter(
        starts_at__date__lte=end, ends_at__date__gte=start, venue__isnull=False
    ).select_related("venue")
    if venue_id:
        query = query.filter(venue_id=venue_id)
        notices = notices.filter(venue_id=venue_id)
    status = request.query_params.get("status")
    if status == "notices":
        query = query.none()
    elif status in ("approved", "pending", "completed"):
        query = query.filter(status=status)
        notices = notices.none()
    slots = []
    for booking in query.order_by("date", "start"):
        private = manager(request.user) or request.user.pk == booking.requester_id
        event = getattr(booking, "event", None)
        slots.append(
            {
                "id": booking.pk if private else None,
                "date": booking.date,
                "start": booking.start,
                "end": booking.end,
                "venue_name": booking.venue.name,
                "status": booking.status,
                "title": booking.title
                if private
                else event.title
                if event and event.published
                else "Reserved",
            }
        )
    return Response(
        {"slots": slots, "notices": NoticeSerializer(notices, many=True).data}
    )
