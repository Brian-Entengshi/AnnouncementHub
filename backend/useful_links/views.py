from config.api import ResourceViewSet
from config.filters import CategoryFacetMixin
from .models import UsefulLink
from .serializers import LinkSerializer


class LinkViewSet(CategoryFacetMixin, ResourceViewSet):
    queryset = UsefulLink.objects.all()
    serializer_class = LinkSerializer
    search_fields = ["title", "description", "category"]
    exact_filters = ("category",)
