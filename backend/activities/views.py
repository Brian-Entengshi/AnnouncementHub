from config.api import ResourceViewSet
from config.permissions import manager
from .models import Activity
from .serializers import ActivitySerializer


class ActivityViewSet(ResourceViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    search_fields = ["title", "description"]

    def get_queryset(self):
        query = super().get_queryset()
        return query if manager(self.request.user) and self.request.query_params.get("manage") == "1" else query.filter(published=True)
