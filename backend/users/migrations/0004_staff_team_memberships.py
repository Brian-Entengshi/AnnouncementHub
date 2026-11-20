import django.db.models.deletion
from django.db import migrations, models


def copy_assignments(apps, schema_editor):
    db = schema_editor.connection.alias
    users = apps.get_model("users", "User").objects.using(db)
    memberships = apps.get_model("users", "TeamMembership")
    users = users.filter(role="staff", team__isnull=False).values_list("pk", "team_id")
    batch = []
    for user_id, team_id in users.iterator():
        batch.append(memberships(user_id=user_id, team_id=team_id))
        if len(batch) == 1000:
            memberships.objects.using(db).bulk_create(batch)
            batch.clear()
    memberships.objects.using(db).bulk_create(batch)


def restore_single_assignment(apps, schema_editor):
    db = schema_editor.connection.alias
    users = apps.get_model("users", "User").objects.using(db)
    memberships = apps.get_model("users", "TeamMembership").objects.using(db)
    first_team = memberships.filter(user_id=models.OuterRef("pk")).order_by("team_id")
    users.filter(role="staff").update(
        team_id=models.Subquery(first_team.values("team_id")[:1])
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_nonstaff_without_team"),
        ("teams", "0003_team_is_active"),
    ]
    operations = [
        migrations.CreateModel(
            name="TeamMembership",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "team",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="teams.team"
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="users.user"
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("user", "team"), name="unique_staff_team"
                    )
                ]
            },
        ),
        migrations.AddField(
            model_name="user",
            name="teams",
            field=models.ManyToManyField(
                blank=True,
                related_name="staff_members",
                through="users.TeamMembership",
                to="teams.team",
            ),
        ),
        migrations.RemoveConstraint(model_name="user", name="staff_has_team"),
        migrations.RemoveConstraint(model_name="user", name="only_staff_have_team"),
        migrations.RunPython(copy_assignments, restore_single_assignment),
        migrations.RemoveField(model_name="user", name="team"),
        migrations.AlterModelOptions(
            name="user",
            options={"verbose_name": "user", "verbose_name_plural": "users"},
        ),
    ]
