from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from announcements.models import Announcement
from announcements.views import published_announcements
from activities.models import Activity
from dashboard.models import HubSettings
from events.models import Event
from .permissions import manager


@api_view(["GET"])
@permission_classes([AllowAny])
def media(request, name):
    privileged = manager(request.user)
    for model, field in [
        (Announcement, "image"),
        (Announcement, "attachment"),
        (Activity, "image"),
        (Event, "image"),
        (HubSettings, "hero_image"),
    ]:
        if model is Activity and not request.user.is_authenticated:
            continue
        query = model.objects.filter(**{field: name})
        if model is HubSettings:
            query = query.filter(pk=1)
        elif not privileged:
            query = (
                query.filter(pk__in=published_announcements())
                if model is Announcement
                else query.filter(published=True)
            )
        obj = query.first()
        if obj and getattr(obj, field).storage.exists(name):
            response = FileResponse(
                getattr(obj, field).open("rb"), as_attachment=field == "attachment"
            )
            response["Cache-Control"] = "private, no-store"
            return response
    raise Http404
