from django.db.models import Q
from django.utils import timezone
from django.utils.functional import cached_property
from audit_logs.models import AuditLog
from config.api import ResourceViewSet
from config.filters import CategoryFacetMixin, filter_date_range
from config.permissions import PublicReadManagerWrite, manager, public_reader
from dashboard.models import HubSettings
from notifications.models import Notification
from .models import Announcement
from .serializers import AnnouncementSerializer, PublicAnnouncementSerializer


def published_announcements():
    return Announcement.objects.filter(
        status="published", published_at__lte=timezone.now()
    ).filter(Q(expires__isnull=True) | Q(expires__gte=timezone.localdate()))


class AnnouncementViewSet(CategoryFacetMixin, ResourceViewSet):
    queryset = Announcement.objects.select_related("author")
    serializer_class = AnnouncementSerializer
    permission_classes = [PublicReadManagerWrite]
    search_fields = ["title", "description", "category"]
    exact_filters = ("category", "status")

    @cached_property
    def landing_settings(self):
        return HubSettings.current()

    def paginate_queryset(self, queryset):
        if self.request.query_params.get("public") == "1":
            self.paginator.page_size = self.landing_settings.announcement_page_size
        return super().paginate_queryset(queryset)

    def get_serializer_class(self):
        return (
            PublicAnnouncementSerializer
            if public_reader(self.request)
            else super().get_serializer_class()
        )

    def get_queryset(self):
        query = super().get_queryset()
        if self.action == "list":
            query = filter_date_range(
                query, self.request.query_params, "published_at__date"
            )
            if (
                self.request.query_params.get("public") == "1"
                and not self.landing_settings.highlight_pinned
            ):
                query = query.order_by("-published_at", "-pk")
        if (
            manager(self.request.user)
            and self.request.query_params.get("manage") == "1"
            and not public_reader(self.request)
        ):
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
        if (
            previous != "published"
            and serializer.validated_data.get("status") == "published"
        ):
            serializer.instance.published_at = timezone.now()
        super().perform_update(serializer)
        if previous != serializer.instance.status:
            record = serializer.instance
            if record.status == "published":
                self.notify(record)
            else:
                action = "Archived" if record.status == "archived" else "Unpublished"
                AuditLog.record(self.request.user, action, record)
