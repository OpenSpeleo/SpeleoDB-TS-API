/** Generated from OpenAPI.yaml by scripts/generate.mjs. Do not edit. */
import { unionFormData, unionUrlEncoded } from "./runtime/form-data";
export function v2_cylinder_fleets_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_fleets_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_fleets_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_fleets_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_fleets_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_fleets_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_fleets_cylinders_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, [
    "last_hydrostatic_test_date",
    "last_visual_inspection_date",
    "manufactured_date",
  ]);
}
export function v2_cylinder_fleets_cylinders_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, [
    "last_hydrostatic_test_date",
    "last_visual_inspection_date",
    "manufactured_date",
  ]);
}
export function v2_cylinder_fleets_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_fleets_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_fleets_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_fleets_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_fleets_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_fleets_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_installs_createMultipart(body?: object): FormData {
  return unionFormData(body, ["distance_from_entry", "uninstall_date"]);
}
export function v2_cylinder_installs_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["distance_from_entry", "uninstall_date"]);
}
export function v2_cylinder_installs_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["distance_from_entry", "uninstall_date"]);
}
export function v2_cylinder_installs_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["distance_from_entry", "uninstall_date"]);
}
export function v2_cylinder_installs_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, ["distance_from_entry", "uninstall_date"]);
}
export function v2_cylinder_installs_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["distance_from_entry", "uninstall_date"]);
}
export function v2_cylinder_installs_pressure_checks_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_installs_pressure_checks_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_installs_pressure_checks_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_installs_pressure_checks_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinder_installs_pressure_checks_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_cylinder_installs_pressure_checks_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_cylinders_updateMultipart(body?: object): FormData {
  return unionFormData(body, [
    "last_hydrostatic_test_date",
    "last_visual_inspection_date",
    "manufactured_date",
  ]);
}
export function v2_cylinders_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, [
    "last_hydrostatic_test_date",
    "last_visual_inspection_date",
    "manufactured_date",
  ]);
}
export function v2_cylinders_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, [
    "last_hydrostatic_test_date",
    "last_visual_inspection_date",
    "manufactured_date",
  ]);
}
export function v2_cylinders_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, [
    "last_hydrostatic_test_date",
    "last_visual_inspection_date",
    "manufactured_date",
  ]);
}
export function v2_experiments_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_experiments_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_experiments_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_experiments_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_experiments_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_experiments_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_experiments_permission_detail_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_experiments_permission_detail_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_experiments_permission_detail_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_experiments_permission_detail_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_experiments_permission_detail_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_experiments_permission_detail_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_exploration_leads_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_exploration_leads_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_exploration_leads_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_exploration_leads_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_geometries_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_gis_geometries_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_geometries_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_geometries_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_geometries_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_geometries_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_geometries_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_geometries_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_geometries_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_geometries_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_layers_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_gis_layers_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_gis_layers_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_layers_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_layers_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_layers_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_layers_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gis_layers_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gis_layers_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gps_tracks_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_gps_tracks_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gps_tracks_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_gps_tracks_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gps_tracks_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gps_tracks_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gps_tracks_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gps_tracks_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_gps_tracks_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_gps_tracks_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_import_gpx_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_import_kml_kmz_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_import_kml_kmz_inspect_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_landmark_collections_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_landmark_collections_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_landmark_collections_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_landmark_collections_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_landmark_collections_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_landmark_collections_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_landmarks_createMultipart(body?: object): FormData {
  return unionFormData(body, ["collection"]);
}
export function v2_landmarks_createUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, ["collection"]);
}
export function v2_landmarks_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["collection"]);
}
export function v2_landmarks_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, ["collection"]);
}
export function v2_landmarks_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["collection"]);
}
export function v2_landmarks_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["collection"]);
}
export function v2_logs_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["attachment"]);
}
export function v2_logs_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, ["attachment"]);
}
export function v2_logs_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["attachment"]);
}
export function v2_logs_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["attachment"]);
}
export function v2_projects_createMultipart(body?: object): FormData {
  return unionFormData(body, ["fork_from", "latitude", "longitude"]);
}
export function v2_projects_createUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, ["fork_from", "latitude", "longitude"]);
}
export function v2_projects_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["fork_from", "latitude", "longitude"]);
}
export function v2_projects_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, ["fork_from", "latitude", "longitude"]);
}
export function v2_projects_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["fork_from", "latitude", "longitude"]);
}
export function v2_projects_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["fork_from", "latitude", "longitude"]);
}
export function v2_projects_exploration_leads_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_exploration_leads_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_permission_team_detail_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_permission_team_detail_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_permission_team_detail_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_permission_team_detail_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_permission_team_detail_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_permission_team_detail_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_permission_user_detail_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_permission_user_detail_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_permission_user_detail_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_permission_user_detail_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_permission_user_detail_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_projects_permission_user_detail_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_release_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_projects_release_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_stations_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_projects_stations_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_projects_uploadMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_resources_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["file", "miniature"]);
}
export function v2_resources_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, ["file", "miniature"]);
}
export function v2_resources_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, ["file", "miniature"]);
}
export function v2_resources_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["file", "miniature"]);
}
export function v2_sensor_fleets_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensor_fleets_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensor_fleets_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensor_fleets_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensor_fleets_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensor_fleets_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensor_fleets_sensors_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_sensor_fleets_sensors_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensors_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_sensors_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_sensors_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_sensors_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_station_tags_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_station_tags_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_station_tags_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_station_tags_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_station_tags_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_station_tags_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_stations_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_stations_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_stations_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_stations_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_stations_experiment_records_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_stations_experiment_records_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_stations_logs_createMultipart(body?: object): FormData {
  return unionFormData(body, ["attachment"]);
}
export function v2_stations_logs_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["attachment"]);
}
export function v2_stations_resources_createMultipart(body?: object): FormData {
  return unionFormData(body, ["file", "miniature"]);
}
export function v2_stations_resources_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["file", "miniature"]);
}
export function v2_stations_sensor_installs_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, [
    "expiracy_battery_date",
    "expiracy_memory_date",
    "uninstall_date",
  ]);
}
export function v2_stations_sensor_installs_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, [
    "expiracy_battery_date",
    "expiracy_memory_date",
    "uninstall_date",
  ]);
}
export function v2_stations_sensor_installs_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, [
    "expiracy_battery_date",
    "expiracy_memory_date",
    "uninstall_date",
  ]);
}
export function v2_stations_sensor_installs_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, [
    "expiracy_battery_date",
    "expiracy_memory_date",
    "uninstall_date",
  ]);
}
export function v2_stations_tags_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_stations_tags_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_permissions_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_permissions_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_permissions_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_permissions_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_permissions_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_permissions_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_surface_networks_stations_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_surface_networks_stations_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_teams_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_teams_createUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_teams_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_teams_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_teams_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_teams_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_teams_memberships_detail_createMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_teams_memberships_detail_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_teams_memberships_detail_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_teams_memberships_detail_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_teams_memberships_detail_destroyMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_teams_memberships_detail_destroyUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_tools_dmp_doctor_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_tools_dmp2json_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_user_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_user_updateUrlEncoded(body?: object): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_user_partial_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_user_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_user_auth_token_createMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_user_auth_token_createUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_user_auth_token_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_user_auth_token_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_user_auth_token_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, []);
}
export function v2_user_auth_token_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
export function v2_user_gis_views_partial_updateMultipart(
  body?: object,
): FormData {
  return unionFormData(body, ["geographic_bound"]);
}
export function v2_user_gis_views_partial_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, ["geographic_bound"]);
}
export function v2_user_password_updateMultipart(body?: object): FormData {
  return unionFormData(body, []);
}
export function v2_user_password_updateUrlEncoded(
  body?: object,
): URLSearchParams {
  return unionUrlEncoded(body, []);
}
