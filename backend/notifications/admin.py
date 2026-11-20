from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Notification

admin.site.register(Notification, RecordsAdmin)
