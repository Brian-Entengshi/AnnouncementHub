from django.db import migrations


def populate(apps, schema_editor):
    team = apps.get_model("teams", "Team")
    for name, description in [
        ("Technical Team", "Coordinates equipment, technical support and event setup."),
        ("Documentation Team", "Maintains activity records and documents campus events."),
        ("Editing Team", "Prepares and edits publication materials for the organization."),
        ("Videographer Team", "Captures and produces video coverage of club activities."),
    ]:
        team.objects.get_or_create(name=name, defaults={"description": description})


class Migration(migrations.Migration):
    dependencies = [("teams", "0001_initial")]
    operations = [migrations.RunPython(populate, migrations.RunPython.noop)]
