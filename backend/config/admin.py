from django.contrib import admin


class RecordsAdmin(admin.ModelAdmin):
    """Read-only inspection keeps workflow changes inside the transactional API."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class HubAdminSite(admin.AdminSite):
    def has_permission(self, request):
        return super().has_permission(request) and not request.user.must_change_password
