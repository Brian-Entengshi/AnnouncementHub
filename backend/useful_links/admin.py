from django.contrib import admin
from config.admin import RecordsAdmin
from .models import UsefulLink

admin.site.register(UsefulLink, RecordsAdmin)
