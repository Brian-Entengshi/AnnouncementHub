from django.utils.dateparse import parse_date
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response


def filter_date_range(queryset, params, start_field, end_field=None):
    """Filter dates inclusively, including periods which overlap the range."""
    bounds = {}
    for name in ("from", "to"):
        value = params.get(name)
        if value:
            try:
                parsed = parse_date(value)
            except ValueError:
                parsed = None
            if parsed is None:
                raise ValidationError({name: "Enter a valid date."})
            bounds[name] = parsed
    start, end = bounds.get("from"), bounds.get("to")
    if start and end and end < start:
        raise ValidationError({"to": "Select an end date on or after the start date."})
    if start:
        queryset = queryset.filter(**{f"{end_field or start_field}__gte": start})
    if end:
        queryset = queryset.filter(**{f"{start_field}__lte": end})
    return queryset


class CategoryFacetMixin:
    @action(detail=False, methods=["get"])
    def categories(self, request):
        categories = (
            self.get_queryset()
            .order_by("category")
            .values_list("category", flat=True)
            .distinct()
        )
        return Response(list(categories))
