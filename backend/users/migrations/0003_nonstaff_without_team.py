from django.db import migrations, models


def clear_nonstaff_teams(apps, schema_editor):
    users = apps.get_model("users", "User").objects.using(
        schema_editor.connection.alias
    )
    users.exclude(role="staff").filter(team__isnull=False).update(team=None)


class Migration(migrations.Migration):
    dependencies = [("users", "0002_alter_user_managers_alter_user_role")]
    operations = [
        migrations.RunPython(clear_nonstaff_teams, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(role="staff") | models.Q(team__isnull=True),
                name="only_staff_have_team",
            ),
        ),
    ]
