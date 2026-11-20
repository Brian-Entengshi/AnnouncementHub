from django.contrib.admin.apps import AdminConfig


class HubAdminConfig(AdminConfig):
    default_site = "config.admin.HubAdminSite"
