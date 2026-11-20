from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        exclude = ("recipient",)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=["get"])
    def unread(self, request):
        return Response({"unread": self.get_queryset().filter(read=False).count()})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        obj = self.get_object()
        obj.read = True
        obj.save(update_fields=["read"])
        return Response({"read": True})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        return Response(
            {"updated": self.get_queryset().filter(read=False).update(read=True)}
        )
