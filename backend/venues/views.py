from datetime import date, timedelta

from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework.decorators import action, api_view
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit_logs.models import AuditLog
from config.api import ResourceViewSet
from config.filters import filter_date_range
from config.permissions import IsAdviser, PublicReadManagerWrite, manager, public_reader
from events.models import Event
from events.serializers import PublicEventSerializer
from notifications.models import Notification
from .models import Venue, Notice
from .serializers import (
    VenueSerializer,
    VenueOptionSerializer,
    NoticeSerializer,
    PublicNoticeSerializer,
    published_notices,
)


class VenueViewSet(ResourceViewSet):
    permission_classes = [IsAdviser]
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    search_fields = ["name", "location", "description"]

    def get_queryset(self):
        venues = super().get_queryset()
        if self.action != "list":
            return venues
        status = self.request.query_params.get("status")
        if status == "archived":
            return venues.filter(archived=True)
        if status == "inactive":
            return venues.filter(archived=False, available=False)
        return venues.filter(archived=False, available=True)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        venue = self.get_object()
        try:
            with transaction.atomic():
                AuditLog.record(request.user, "Deleted", venue)
                venue.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": "This venue has linked events or notices. Archive it to preserve those records."
                },
                status=409,
            )
        return Response({"detail": "Venue deleted successfully."})

    def perform_update(self, serializer):
        was_available = serializer.instance.available
        super().perform_update(serializer)
        if was_available != serializer.instance.available:
            action_name = (
                "Reactivated" if serializer.instance.available else "Deactivated"
            )
            AuditLog.record(self.request.user, action_name, serializer.instance)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def archive(self, request, pk=None):
        venue = self.get_object()
        if not venue.archived:
            venue.archived = True
            venue.available = False
            venue.save(update_fields=["archived", "available"])
            AuditLog.record(request.user, "Archived", venue)
        return Response(
            {"detail": "Venue archived. Existing events and notices were kept."}
        )


class VenueOptionList(ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Venue.objects.filter(archived=False, available=True)
    serializer_class = VenueOptionSerializer


class NoticeViewSet(ResourceViewSet):
    queryset = Notice.objects.select_related("venue", "author")
    permission_classes = [PublicReadManagerWrite]
    serializer_class = NoticeSerializer
    search_fields = ["title", "description", "venue__name", "venue_snapshot"]
    exact_filters = ("venue_id",)

    def get_serializer_class(self):
        return (
            PublicNoticeSerializer
            if public_reader(self.request)
            else super().get_serializer_class()
        )

    def get_queryset(self):
        query = super().get_queryset()
        params = self.request.query_params
        managing = (
            manager(self.request.user)
            and params.get("manage") == "1"
            and not public_reader(self.request)
        )
        if not managing:
            query = query.filter(
                pk__in=published_notices().values("pk"), ends_at__gt=timezone.now()
            )
        if self.action == "list":
            now = timezone.now()
            statuses = {
                "current": {"starts_at__lte": now, "ends_at__gt": now},
                "upcoming": {"starts_at__gt": now},
                "expired": {"ends_at__lte": now},
            }
            query = query.filter(**statuses.get(params.get("status"), {}))
            if managing and params.get("publication_status") in (
                "draft",
                "published",
                "archived",
            ):
                query = query.filter(publication_status=params["publication_status"])
            query = filter_date_range(query, params, "starts_at__date", "ends_at__date")
        return query

    def save_notice(self, serializer, action):
        before = getattr(serializer.instance, "publication_status", None)
        publishing = (
            serializer.validated_data.get("publication_status") == "published"
            and before != "published"
        )
        values = {"author": self.request.user} if action == "Created" else {}
        if publishing:
            values["published_at"] = timezone.now()
        notice = serializer.save(**values)
        AuditLog.record(self.request.user, action, notice)
        if publishing:
            Notification.broadcast(notice.title, f"/venue-notices/{notice.pk}")
            AuditLog.record(self.request.user, "Published", notice)
        elif before and before != notice.publication_status:
            step = (
                "Archived" if notice.publication_status == "archived" else "Unpublished"
            )
            AuditLog.record(self.request.user, step, notice)

    def perform_create(self, serializer):
        self.save_notice(serializer, "Created")

    def perform_update(self, serializer):
        self.save_notice(serializer, "Updated")


@api_view(["GET"])
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

    notices = (
        published_notices()
        .filter(starts_at__date__lte=end, ends_at__date__gte=start)
        .select_related("venue", "author")
    )
    events = Event.objects.filter(
        venue__available=True,
        venue__archived=False,
        published=True,
        cancelled=False,
        date__range=(start, end),
    ).select_related("venue", "author")
    if venue_id:
        notices = notices.filter(venue_id=venue_id)
        events = events.filter(venue_id=venue_id)
    kind = request.query_params.get("status")
    return Response(
        {
            "notices": PublicNoticeSerializer(
                notices if kind != "events" else [], many=True
            ).data,
            "events": PublicEventSerializer(
                events if kind != "notices" else [],
                many=True,
                context={"request": request},
            ).data,
        }
    )
