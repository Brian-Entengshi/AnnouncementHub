from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Event

admin.site.register(Event, RecordsAdmin)
