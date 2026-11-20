from django.contrib import admin
from config.admin import RecordsAdmin
from .models import HubSettings

admin.site.register(HubSettings, RecordsAdmin)
