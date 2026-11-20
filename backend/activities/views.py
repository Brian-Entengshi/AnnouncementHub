from config.api import ResourceViewSet
from config.filters import filter_date_range
from config.permissions import manager
from django.utils import timezone
from .models import Activity
from .serializers import ActivitySerializer


class ActivityViewSet(ResourceViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    search_fields = ["title", "description"]

    def get_queryset(self):
        query = super().get_queryset()
        if self.action == "list":
            today = timezone.localdate()
            status = self.request.query_params.get("status")
            statuses = {
                "upcoming": {"start_date__gt": today},
                "ongoing": {"start_date__lte": today, "end_date__gte": today},
                "completed": {"end_date__lt": today},
            }
            query = query.filter(**statuses.get(status, {}))
            query = filter_date_range(
                query, self.request.query_params, "start_date", "end_date"
            )
        return (
            query
            if manager(self.request.user)
            and self.request.query_params.get("manage") == "1"
            else query.filter(published=True)
        )
