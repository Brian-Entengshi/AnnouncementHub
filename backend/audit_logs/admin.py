from django.contrib import admin
from config.admin import RecordsAdmin
from .models import AuditLog

admin.site.register(AuditLog, RecordsAdmin)
