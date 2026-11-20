from django.urls import path
from .views import dashboard, settings_view

urlpatterns = [path("dashboard/", dashboard), path("settings/", settings_view)]
