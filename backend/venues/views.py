from datetime import date, timedelta
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.api import ResourceViewSet
from config.permissions import manager
from notifications.models import Notification
from reservations.models import Reservation
from .models import Venue, Notice
from .serializers import VenueSerializer, NoticeSerializer


class VenueViewSet(ResourceViewSet):
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    search_fields = ["name", "location"]


class NoticeViewSet(ResourceViewSet):
    queryset = Notice.objects.select_related("venue")
    serializer_class = NoticeSerializer
    search_fields = ["title", "venue__name"]
    exact_filters = ("venue_id",)

    def get_queryset(self):
        query = super().get_queryset()
        if manager(self.request.user) and self.request.query_params.get("manage") == "1":
            return query
        return query.filter(ends_at__gt=timezone.now())

    def perform_create(self, serializer):
        super().perform_create(serializer)
        Notification.broadcast(serializer.instance.title, f"/venue-notices/{serializer.instance.pk}")


@api_view(["GET"])
@permission_classes([AllowAny])
def availability(request):
    try:
        start = date.fromisoformat(request.query_params.get("from", str(timezone.localdate())))
        end = date.fromisoformat(request.query_params.get("to", str(start + timedelta(days=6))))
        if not 0 <= (end - start).days <= 42:
            raise ValueError()
        venue_id = int(request.query_params.get("venue") or 0)
    except ValueError:
        return Response({"detail": "Choose a valid venue and a range of up to 43 days."}, status=400)
    query = Reservation.objects.filter(date__range=(start, end)).select_related("venue", "event")
    visible = ["approved", "completed"]
    if manager(request.user):
        visible.append("pending")
    from django.db.models import Q
    scope = Q(status__in=visible)
    if request.user.is_authenticated:
        scope |= Q(requester=request.user, status="pending")
    query = query.filter(scope)
    notices = Notice.objects.filter(starts_at__date__lte=end, ends_at__date__gte=start).select_related("venue")
    if venue_id:
        query = query.filter(venue_id=venue_id)
        notices = notices.filter(venue_id=venue_id)
    slots = []
    for booking in query.order_by("date", "start"):
        private = manager(request.user) or request.user.pk == booking.requester_id
        event = getattr(booking, "event", None)
        slots.append({"id": booking.pk if private else None, "date": booking.date, "start": booking.start,
                      "end": booking.end, "venue_name": booking.venue.name, "status": booking.status,
                      "title": booking.title if private else event.title if event and event.published else "Reserved"})
    return Response({"slots": slots, "notices": NoticeSerializer(notices, many=True).data})
