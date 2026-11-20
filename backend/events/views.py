from config.api import ResourceViewSet
from config.permissions import manager
from .models import Event
from .serializers import EventSerializer


class EventViewSet(ResourceViewSet):
    queryset = Event.objects.select_related("reservation__venue", "activity")
    serializer_class = EventSerializer
    search_fields = [
        "title",
        "description",
        "reservation__venue__name",
        "reservation__venue_snapshot",
    ]

    def get_queryset(self):
        query = super().get_queryset()
        if not (
            manager(self.request.user)
            and self.request.query_params.get("manage") == "1"
        ):
            query = query.filter(published=True)
        from datetime import date
        from rest_framework.exceptions import ValidationError

        for param, lookup in [
            ("from", "reservation__date__gte"),
            ("to", "reservation__date__lte"),
        ]:
            if value := self.request.query_params.get(param):
                try:
                    query = query.filter(**{lookup: date.fromisoformat(value)})
                except ValueError:
                    raise ValidationError("Enter a valid calendar date.")
        return query
