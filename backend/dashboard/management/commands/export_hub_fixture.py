from pathlib import Path
from tempfile import NamedTemporaryFile

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import serializers
from django.core.management import BaseCommand, call_command
from django.core.serializers.json import Serializer as JSONSerializer
from django.db import transaction


class Serializer(JSONSerializer):
    def handle_field(self, obj, field):
        if isinstance(obj, get_user_model()) and field.name == "password":
            self._current[field.name] = "!"
        else:
            super().handle_field(obj, field)

    def get_dump_object(self, obj):
        record = super().get_dump_object(obj)
        # These rows have Django-managed identities on the migrated target.
        if record["model"] in {"auth.permission", "contenttypes.contenttype"}:
            record.pop("pk", None)
        return record


class Command(BaseCommand):
    help = (
        "Export a Django fixture with application data and unusable account passwords."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output", type=Path, default=settings.BASE_DIR / "backup.json"
        )

    def handle(self, *args, **options):
        output = options["output"].resolve()
        serializers.register_serializer("hub_fixture", __name__)
        temporary = None
        try:
            with NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=output.parent, delete=False
            ) as stream:
                temporary = Path(stream.name)
                with transaction.atomic():
                    call_command(
                        "dumpdata",
                        format="hub_fixture",
                        stdout=stream,
                        exclude=["sessions.session"],
                        use_natural_foreign_keys=True,
                        use_base_manager=True,
                        indent=2,
                        verbosity=0,
                    )
            temporary.replace(output)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        self.stdout.write(f"Exported data fixture to {output}")
