from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Venue, Notice

admin.site.register(Venue, RecordsAdmin)
admin.site.register(Notice, RecordsAdmin)
