from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Activity

admin.site.register(Activity, RecordsAdmin)
