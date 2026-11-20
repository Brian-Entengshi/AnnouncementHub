from django.db import migrations


def normalize_authentication(apps, schema_editor):
    logs = (
        apps.get_model("audit_logs", "AuditLog")
        .objects.using(schema_editor.connection.alias)
        .filter(resource="authentication")
    )
    for previous, current in [
        ("Login", "LOGIN"),
        ("Logout", "LOGOUT"),
        ("Login failed", "FAILED_LOGIN"),
    ]:
        logs.filter(action=previous).update(action=current)


class Migration(migrations.Migration):
    dependencies = [
        ("audit_logs", "0003_auditlog_actor_name_auditlog_actor_role_and_more")
    ]
    operations = [
        migrations.RunPython(normalize_authentication, migrations.RunPython.noop)
    ]
