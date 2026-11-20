from django.db import transaction
from django.db.models.deletion import ProtectedError
from rest_framework import serializers, viewsets
from rest_framework.filters import SearchFilter
from audit_logs.models import AuditLog
from .permissions import PublicReadManagerWrite


class ResourceViewSet(viewsets.ModelViewSet):
    permission_classes = [PublicReadManagerWrite]
    filter_backends = [SearchFilter]
    exact_filters = ()

    def get_queryset(self):
        query = super().get_queryset()
        for name in self.exact_filters:
            value = self.request.query_params.get(name)
            if value:
                query = query.filter(**{name: value})
        return query

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        record = serializer.save()
        AuditLog.record(self.request.user, "Created", record)

    def perform_update(self, serializer):
        record = serializer.save()
        AuditLog.record(self.request.user, "Updated", record)

    @transaction.atomic
    def perform_destroy(self, instance):
        AuditLog.record(self.request.user, "Deleted", instance)
        try:
            instance.delete()
        except ProtectedError:
            raise serializers.ValidationError("This record is in use. Update its status or reassign its related records first.")

