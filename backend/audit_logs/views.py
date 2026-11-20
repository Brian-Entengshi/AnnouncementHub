from rest_framework import serializers, viewsets
from config.permissions import IsAdviser
from .models import AuditLog


class AuditSerializer(serializers.ModelSerializer):
    actor = serializers.StringRelatedField()

    class Meta:
        model = AuditLog
        fields = "__all__"


class AuditViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditSerializer
    permission_classes = [IsAdviser]
