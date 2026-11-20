from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from announcements.models import Announcement
from announcements.views import published_announcements
from activities.models import Activity
from events.models import Event
from .permissions import manager


@api_view(["GET"])
@permission_classes([AllowAny])
def media(request, name):
    privileged = manager(request.user)
    for model, field in [(Announcement, "image"), (Announcement, "attachment"), (Activity, "image"), (Event, "image")]:
        query = model.objects.filter(**{field: name})
        if not privileged:
            query = query.filter(pk__in=published_announcements()) if model is Announcement else query.filter(published=True)
        obj = query.first()
        if obj:
            response = FileResponse(getattr(obj, field).open("rb"), as_attachment=field == "attachment")
            response["Cache-Control"] = "private, no-store"
            return response
    raise Http404
