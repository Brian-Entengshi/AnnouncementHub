from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Announcement

admin.site.register(Announcement, RecordsAdmin)
