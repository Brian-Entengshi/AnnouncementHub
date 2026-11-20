from django.db.models import Q
from django.utils import timezone
from audit_logs.models import AuditLog
from config.api import ResourceViewSet
from config.permissions import manager
from notifications.models import Notification
from .models import Announcement
from .serializers import AnnouncementSerializer


def published_announcements():
    return Announcement.objects.filter(status="published", published_at__lte=timezone.now()).filter(
        Q(expires__isnull=True) | Q(expires__gte=timezone.localdate()))


class AnnouncementViewSet(ResourceViewSet):
    queryset = Announcement.objects.select_related("author")
    serializer_class = AnnouncementSerializer
    search_fields = ["title", "description", "category"]
    exact_filters = ("category", "status")

    def get_queryset(self):
        query = super().get_queryset()
        if manager(self.request.user) and self.request.query_params.get("manage") == "1":
            return query
        return query.filter(pk__in=published_announcements().values("pk"))

    def notify(self, record):
        if record.status == "published":
            Notification.broadcast(record.title, f"/announcements/{record.pk}")
            AuditLog.record(self.request.user, "Published", record)

    def perform_create(self, serializer):
        record = serializer.save(author=self.request.user)
        AuditLog.record(self.request.user, "Created", record)
        self.notify(record)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        if previous != "published" and serializer.validated_data.get("status") == "published":
            serializer.instance.published_at = timezone.now()
        super().perform_update(serializer)
        if previous != serializer.instance.status:
            self.notify(serializer.instance)
