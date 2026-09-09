//! Live GET /snapshot client — snapshot-only contract (no invented compra/history/routes).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotPayload {
    pub analysis: Option<SnapshotAnalysis>,
    pub indicators: Option<SnapshotIndicators>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotAnalysis {
    pub stress: Option<SnapshotStress>,
    pub narrative: Option<SnapshotNarrative>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotStress {
    pub score: Option<f64>,
    pub severity: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotNarrative {
    pub headline: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct SnapshotIndicators {
    #[serde(rename = "dolar_blue")]
    pub dolar_blue: Option<SnapshotIndicator>,
    #[serde(rename = "dolar_oficial")]
    pub dolar_oficial: Option<SnapshotIndicator>,
    #[serde(rename = "dolar_mep")]
    pub dolar_mep: Option<SnapshotIndicator>,
    #[serde(rename = "dolar_ccl")]
    pub dolar_ccl: Option<SnapshotIndicator>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotVariations {
    pub dod: Option<f64>,
    pub wow: Option<f64>,
    pub mom: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotIndicator {
    pub amount: Option<f64>,
    pub compra: Option<f64>,
    pub venta: Option<f64>,
    pub previous: Option<f64>,
    pub date: Option<String>,
    #[serde(rename = "isMock", alias = "is_mock")]
    pub is_mock: Option<bool>,
    pub spark: Option<Vec<f64>>,
    pub variations: Option<SnapshotVariations>,
}

impl SnapshotIndicator {
    /// Sell side of the print. Compra is separate and often absent.
    pub fn live_venta(&self) -> Option<f64> {
        if self.is_mock == Some(true) {
            return None;
        }
        self.venta.or(self.amount)
    }

    pub fn live_compra(&self) -> Option<f64> {
        if self.is_mock == Some(true) {
            return None;
        }
        self.compra
    }

    pub fn live_date(&self) -> Option<&str> {
        if self.is_mock == Some(true) {
            return None;
        }
        self.date
            .as_deref()
            .filter(|d| !d.is_empty())
    }

    pub fn live_spark(&self) -> Option<&[f64]> {
        if self.is_mock == Some(true) {
            return None;
        }
        self.spark
            .as_deref()
            .filter(|s| s.len() >= 2)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GlanceQuote {
    Blue,
    Oficial,
    Mep,
    Ccl,
}

impl GlanceQuote {
    pub const ALL: [GlanceQuote; 4] = [
        GlanceQuote::Blue,
        GlanceQuote::Oficial,
        GlanceQuote::Mep,
        GlanceQuote::Ccl,
    ];

    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "blue" => Some(Self::Blue),
            "oficial" => Some(Self::Oficial),
            "mep" => Some(Self::Mep),
            "ccl" => Some(Self::Ccl),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayPrefs {
    pub glance: String,
    pub shown: Vec<String>,
    pub chart_quote: String,
    pub show_variations: bool,
    pub show_headline: bool,
    pub show_stress: bool,
}

impl Default for TrayPrefs {
    fn default() -> Self {
        Self {
            glance: "blue".to_string(),
            shown: vec![
                "blue".to_string(),
                "oficial".to_string(),
                "mep".to_string(),
                "ccl".to_string(),
            ],
            chart_quote: "blue".to_string(),
            show_variations: true,
            show_headline: true,
            show_stress: true,
        }
    }
}

pub fn indicator_for<'a>(
    quote: GlanceQuote,
    snapshot: Option<&'a SnapshotPayload>,
) -> Option<&'a SnapshotIndicator> {
    let indicators = snapshot?.indicators.as_ref()?;
    match quote {
        GlanceQuote::Blue => indicators.dolar_blue.as_ref(),
        GlanceQuote::Oficial => indicators.dolar_oficial.as_ref(),
        GlanceQuote::Mep => indicators.dolar_mep.as_ref(),
        GlanceQuote::Ccl => indicators.dolar_ccl.as_ref(),
    }
}

/// Menu/tray title: chosen quote venta, else another shown, else product name.
/// Never the stress score.
pub fn menu_title(succeeded: bool, snapshot: Option<&SnapshotPayload>, prefs: &TrayPrefs) -> String {
    if !succeeded {
        return "DólarGaucho".to_string();
    }
    let glance = GlanceQuote::parse(&prefs.glance).unwrap_or(GlanceQuote::Blue);
    if let Some(amount) = indicator_for(glance, snapshot).and_then(|i| i.live_venta()) {
        return format_amount_es_ar(amount);
    }
    for key in &prefs.shown {
        if let Some(q) = GlanceQuote::parse(key) {
            if let Some(amount) = indicator_for(q, snapshot).and_then(|i| i.live_venta()) {
                return format_amount_es_ar(amount);
            }
        }
    }
    for q in GlanceQuote::ALL {
        if let Some(amount) = indicator_for(q, snapshot).and_then(|i| i.live_venta()) {
            return format_amount_es_ar(amount);
        }
    }
    "DólarGaucho".to_string()
}

#[derive(Debug)]
pub enum SnapshotError {
    Http(#[allow(dead_code)] reqwest::Error),
    Status(#[allow(dead_code)] u16),
    Empty,
}

pub async fn fetch_snapshot(url: &str) -> Result<SnapshotPayload, SnapshotError> {
    let response = reqwest::Client::new()
        .get(url)
        .header("Accept", "application/json")
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(SnapshotError::Http)?;

    let status = response.status();
    if !status.is_success() {
        return Err(SnapshotError::Status(status.as_u16()));
    }

    let bytes = response.bytes().await.map_err(SnapshotError::Http)?;
    if bytes.is_empty() {
        return Err(SnapshotError::Empty);
    }

    // Ignore unknown fields (corridor prints, etc.) — only the signed v1 paths matter.
    serde_json::from_slice(&bytes).map_err(|_| SnapshotError::Empty)
}

/// Match Mac `DisplayFormatting.amount` — `$` + es_AR decimal grouping.
pub fn format_amount_es_ar(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    let is_int = (rounded - rounded.trunc()).abs() < f64::EPSILON;
    let body = if is_int {
        format_int_grouped(rounded as i64)
    } else {
        let int_part = rounded.trunc() as i64;
        let frac = ((rounded.fract().abs() * 100.0).round() as i64).rem_euclid(100);
        format!("{},{:02}", format_int_grouped(int_part), frac)
    };
    format!("${body}")
}

fn format_int_grouped(n: i64) -> String {
    let neg = n < 0;
    let s = n.abs().to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    let mut grouped: String = out.chars().rev().collect();
    if neg {
        grouped.insert(0, '-');
    }
    grouped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn amount_formats_like_mac() {
        assert_eq!(format_amount_es_ar(1545.0), "$1.545");
        assert_eq!(format_amount_es_ar(1545.5), "$1.545,50");
    }

    #[test]
    fn venta_falls_back_to_amount() {
        let ind = SnapshotIndicator {
            amount: Some(1545.0),
            compra: None,
            venta: None,
            is_mock: Some(false),
            ..Default::default()
        };
        assert_eq!(ind.live_venta(), Some(1545.0));
        assert_eq!(ind.live_compra(), None);
    }

    #[test]
    fn mock_is_dropped() {
        let ind = SnapshotIndicator {
            amount: Some(1.0),
            compra: Some(1.0),
            venta: Some(1.0),
            is_mock: Some(true),
            ..Default::default()
        };
        assert!(ind.live_venta().is_none());
    }

    #[test]
    fn menu_title_never_uses_stress() {
        let payload = SnapshotPayload {
            analysis: Some(SnapshotAnalysis {
                stress: Some(SnapshotStress {
                    score: Some(42.0),
                    severity: Some("high".into()),
                }),
                narrative: None,
            }),
            indicators: Some(SnapshotIndicators {
                dolar_blue: Some(SnapshotIndicator {
                    amount: Some(1545.0),
                    is_mock: Some(false),
                    ..Default::default()
                }),
                ..Default::default()
            }),
        };
        let prefs = TrayPrefs::default();
        assert_eq!(menu_title(true, Some(&payload), &prefs), "$1.545");
        assert_eq!(menu_title(false, Some(&payload), &prefs), "DólarGaucho");
    }

    #[test]
    fn menu_title_falls_back_to_another_shown() {
        let payload = SnapshotPayload {
            analysis: None,
            indicators: Some(SnapshotIndicators {
                dolar_oficial: Some(SnapshotIndicator {
                    amount: Some(1530.0),
                    is_mock: Some(false),
                    ..Default::default()
                }),
                ..Default::default()
            }),
        };
        let prefs = TrayPrefs {
            glance: "blue".into(),
            shown: vec!["blue".into(), "oficial".into()],
            ..Default::default()
        };
        assert_eq!(menu_title(true, Some(&payload), &prefs), "$1.530");
    }

    #[test]
    fn parses_live_shaped_fixture() {
        let raw = include_str!("fixtures/snapshot_sample.json");
        let payload: SnapshotPayload = serde_json::from_str(raw).expect("decode");
        let blue = payload.indicators.as_ref().unwrap().dolar_blue.as_ref().unwrap();
        assert!(blue.live_venta().is_some());
        assert!(blue.live_spark().is_some());
        assert!(payload.analysis.as_ref().unwrap().stress.is_some());
    }
}

