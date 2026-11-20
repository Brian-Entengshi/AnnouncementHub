from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Team

admin.site.register(Team, RecordsAdmin)
