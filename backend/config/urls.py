from django.contrib import admin
from django.urls import include, path
from .media import media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/media/<path:name>", media),
    path("api/", include("users.urls")),
    path("api/", include("teams.urls")),
    path("api/", include("venues.urls")),
    path("api/", include("reservations.urls")),
    path("api/", include("events.urls")),
    path("api/", include("activities.urls")),
    path("api/", include("announcements.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("useful_links.urls")),
    path("api/", include("audit_logs.urls")),
    path("api/", include("dashboard.urls")),
]
