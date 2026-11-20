from django.contrib import admin
from config.admin import RecordsAdmin
from .models import User

admin.site.register(User, RecordsAdmin)
