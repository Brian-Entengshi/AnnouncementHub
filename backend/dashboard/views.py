from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.permissions import adviser, manager
from announcements.views import published_announcements
from announcements.serializers import AnnouncementSerializer
from activities.models import Activity
from activities.serializers import ActivitySerializer
from events.models import Event
from events.serializers import EventSerializer
from venues.models import Notice, Venue
from venues.serializers import NoticeSerializer
from teams.models import Team
from reservations.models import Reservation
from .models import HubSettings


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HubSettings
        fields = ("contact_email", "office_hours")


@api_view(["GET", "PATCH"])
@permission_classes([AllowAny])
def settings_view(request):
    if request.method == "PATCH" and not adviser(request.user):
        return Response({"detail": "An adviser account is required."}, status=403)
    obj, _ = HubSettings.objects.get_or_create(pk=1)
    if request.method == "PATCH":
        serializer = SettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(SettingsSerializer(obj).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def dashboard(request):
    today = timezone.localdate()
    events = Event.objects.filter(published=True, reservation__status="approved", reservation__date__gte=today).select_related("reservation__venue", "activity")
    announcements = published_announcements().select_related("author")
    activities = Activity.objects.filter(published=True, end_date__gte=today)
    notices = Notice.objects.filter(ends_at__gt=timezone.now()).select_related("venue")
    reservations = Reservation.objects.filter(status="pending")
    if not manager(request.user):
        reservations = reservations.filter(requester_id=request.user.pk)
    return Response({
        "today": today,
        "counts": {"events": events.filter(reservation__date__lt=today+timedelta(days=7)).count(),
                   "announcements": announcements.count(), "venues": Venue.objects.filter(available=True).count(),
                   "teams": Team.objects.count(), "pending": reservations.count() if request.user.is_authenticated else None},
        "events": EventSerializer(events[:4], many=True).data,
        "announcements": AnnouncementSerializer(announcements[:3], many=True).data,
        "activities": ActivitySerializer(activities[:3], many=True).data,
        "notices": NoticeSerializer(notices[:3], many=True).data,
        "unread": request.user.notifications.filter(read=False).count() if request.user.is_authenticated else 0,
    })
