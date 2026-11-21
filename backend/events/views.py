from django.db.models import Q
from django.utils import timezone

from audit_logs.models import AuditLog
from config.api import ResourceViewSet
from config.filters import filter_date_range
from config.permissions import PublicReadManagerWrite, manager, public_reader
from .models import Event
from .serializers import EventSerializer, PublicEventSerializer


def upcoming_events(query):
    now = timezone.localtime()
    return query.filter(cancelled=False).filter(
        Q(date__gt=now.date()) | Q(date=now.date(), end__gt=now.time())
    )


class EventViewSet(ResourceViewSet):
    queryset = Event.objects.select_related("venue", "activity", "author")
    permission_classes = [PublicReadManagerWrite]
    serializer_class = EventSerializer
    search_fields = ["title", "description", "venue__name", "venue_snapshot"]

    def get_serializer_class(self):
        return (
            PublicEventSerializer
            if public_reader(self.request)
            else super().get_serializer_class()
        )

    def get_queryset(self):
        query = super().get_queryset()
        params = self.request.query_params
        if not (
            manager(self.request.user)
            and params.get("manage") == "1"
            and not public_reader(self.request)
        ):
            query = query.filter(published=True)
        if self.action == "list":
            query = filter_date_range(query, params, "date")
            if params.get("upcoming") == "1":
                query = upcoming_events(query)
        return query

    def perform_create(self, serializer):
        event = serializer.save(author=self.request.user)
        AuditLog.record(self.request.user, "Created", event)
