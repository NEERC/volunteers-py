from volunteers.services.geoip import GeoIPService


def test_not_configured() -> None:
    assert GeoIPService(database_path=None).country_code("8.8.8.8") is None


def test_missing_database() -> None:
    assert GeoIPService(database_path="/nonexistent.mmdb").country_code("8.8.8.8") is None
