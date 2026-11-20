from django.urls import path
from .views import dashboard, help_view, settings_view

urlpatterns = [
    path("dashboard/", dashboard),
    path("help/", help_view),
    path("settings/", settings_view),
]
