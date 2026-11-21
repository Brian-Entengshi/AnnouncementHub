from django.urls import path
from .views import dashboard, organization, settings_view

urlpatterns = [
    path("dashboard/", dashboard),
    path("organization/", organization),
    path("settings/", settings_view),
]
