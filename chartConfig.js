var chartConfig = {
  fullscreen: true,
  timezone: "Asia/Shanghai",
  container_id: "tv_chart_container",
  datafeed: new FeedBase(),
  library_path: "charting_library/",
  locale: "zh",
  disabled_features: ["control_bar", "timeframes_toolbar", "main_series_scale_menu", "symbol_search_hot_key", "header_symbol_search", "header_resolutions", "header_settings","save_chart_properties_to_local_storage", "header_chart_type", "header_compare", "header_undo_redo", "header_screenshot", "use_localstorage_for_settings", "volume_force_overlay"],
  enabled_features: ["keep_left_toolbar_visible_on_small_screens", "side_toolbar_in_fullscreen_mode", "hide_left_toolbar_by_default", "left_toolbar", "keep_left_toolbar_visible_on_small_screens", "hide_last_na_study_output", "move_logo_to_main_pane", "dont_show_boolean_study_arguments"],
  custom_css_url: "chart.css",
  studies_overrides: {
    "volume.precision": 0
  },
  overrides: {
    "paneProperties.background": "#ffffff",
    "paneProperties.vertGridProperties.color": "rgba(0,0,0,0)",
    "paneProperties.horzGridProperties.color": "rgba(0,0,0,0)",
    "scalesProperties.textColor": "#333",
    volumePaneSize: "medium",
    "paneProperties.legendProperties.showStudyArguments": !0,
    "paneProperties.legendProperties.showStudyTitles": !0,
    "paneProperties.legendProperties.showStudyValues": !0
  }
}