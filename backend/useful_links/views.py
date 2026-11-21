from rest_framework.exceptions import ValidationError

from config.api import ResourceViewSet
from config.filters import CategoryFacetMixin
from config.permissions import PublicReadManagerWrite, manager, public_reader
from .models import UsefulLink
from .serializers import LinkSerializer, PublicLinkSerializer


class LinkViewSet(CategoryFacetMixin, ResourceViewSet):
    queryset = UsefulLink.objects.all()
    serializer_class = LinkSerializer
    permission_classes = [PublicReadManagerWrite]
    search_fields = ["title", "description", "category"]
    exact_filters = ("category",)

    def get_queryset(self):
        links = super().get_queryset()
        public = public_reader(self.request)
        if public:
            links = links.filter(is_public=True)
        if self.action == "list" and (public or manager(self.request.user)):
            visibility = self.request.query_params.get("is_public")
            if visibility not in (None, ""):
                if visibility not in ("true", "false"):
                    raise ValidationError({"is_public": "Use true or false."})
                links = links.filter(is_public=visibility == "true")
        return links

    def get_serializer_class(self):
        if public_reader(self.request):
            return PublicLinkSerializer
        return super().get_serializer_class()
