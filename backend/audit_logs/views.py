from rest_framework import serializers, viewsets
from rest_framework.filters import SearchFilter
from rest_framework.pagination import PageNumberPagination
from config.permissions import IsAdviser
from .models import AuditLog


class AuditSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_role",
            "action",
            "resource",
            "label",
            "object_id",
            "description",
            "at",
        )

    def get_actor(self, record):
        return record.actor_name or (str(record.actor) if record.actor else None)


class AuditPagination(PageNumberPagination):
    page_size = 20


class AuditViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditSerializer
    permission_classes = [IsAdviser]
    pagination_class = AuditPagination
    filter_backends = [SearchFilter]
    search_fields = [
        "actor_name",
        "actor__first_name",
        "actor__username",
        "action",
        "resource",
        "label",
        "description",
    ]

    def get_queryset(self):
        rows = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            rows = rows.filter(actor_role=role)
        resource = self.request.query_params.get("resource")
        return rows.filter(resource=resource) if resource else rows
