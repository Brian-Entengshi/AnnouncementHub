from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.views.decorators.cache import never_cache
from audit_logs.models import AuditLog
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.permissions import IsAdviser
from announcements.views import published_announcements
from announcements.serializers import AnnouncementSerializer
from activities.models import Activity
from activities.serializers import ActivitySerializer
from events.models import Event
from events.serializers import EventSerializer
from events.views import upcoming_events
from venues.models import Venue
from venues.serializers import NoticeSerializer, published_notices
from teams.models import Team
from .models import HubSettings
from .serializers import PublicOrganizationSerializer, SettingsSerializer


LANDING_AUDIT_AREAS = (
    (
        "Home copy",
        (
            "hero_heading",
            "hero_welcome",
            "hero_description",
            "hero_cta_label",
            "hero_cta_section",
        ),
    ),
    ("Home image", ("hero_image", "hero_image_alt")),
    (
        "About",
        (
            "about_heading",
            "about_intro",
            "about_description",
            "about_purpose",
            "about_mission",
            "about_vision",
        ),
    ),
    (
        "Contacts",
        (
            "contact_heading",
            "contact_intro",
            "contact_email",
            "contact_phone",
            "office_location",
            "office_hours",
            "facebook_url",
            "instagram_url",
            "website_url",
        ),
    ),
    ("announcement display", ("highlight_pinned", "announcement_page_size")),
)


@api_view(["GET", "PATCH"])
@permission_classes([IsAdviser])
@never_cache
def settings_view(request):
    if request.method == "GET":
        return Response(SettingsSerializer(HubSettings.current()).data)

    with transaction.atomic():
        obj, _ = HubSettings.objects.select_for_update().get_or_create(pk=1)
        serializer = SettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = {
            field
            for field, value in serializer.validated_data.items()
            if (
                bool(obj.hero_image)
                if field == "hero_image" and value is None
                else getattr(obj, field) != value
            )
        }
        if changed:
            serializer.save()
            areas = [
                area
                for area, fields in LANDING_AUDIT_AREAS
                if changed.intersection(fields)
            ]
            AuditLog.record(
                request.user,
                "Published",
                obj,
                resource="settings",
                description=f"Published Student Access changes to {', '.join(areas)}.",
            )
        return Response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
@never_cache
def organization(request):
    return Response(PublicOrganizationSerializer(HubSettings.current()).data)


@api_view(["GET"])
def dashboard(request):
    today = timezone.localdate()
    events = upcoming_events(
        Event.objects.filter(published=True).select_related(
            "venue", "activity", "author"
        )
    )
    announcements = published_announcements().select_related("author")
    activities = Activity.objects.filter(published=True, end_date__gte=today)
    notices = (
        published_notices()
        .filter(ends_at__gt=timezone.now())
        .select_related("venue", "author")
    )
    return Response(
        {
            "today": today,
            "counts": {
                "events": events.filter(date__lt=today + timedelta(days=7)).count(),
                "announcements": announcements.count(),
                "venues": Venue.objects.filter(archived=False, available=True).count(),
                "teams": Team.objects.filter(is_active=True).count(),
            },
            "events": EventSerializer(events[:4], many=True).data,
            "announcements": AnnouncementSerializer(announcements[:3], many=True).data,
            "activities": ActivitySerializer(activities[:3], many=True).data,
            "notices": NoticeSerializer(notices[:3], many=True).data,
            "unread": request.user.notifications.filter(read=False).count(),
        }
    )
