//! Live GET /snapshot client — snapshot-only contract (no invented compra/history/routes).

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct SnapshotPayload {
    pub indicators: Option<SnapshotIndicators>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SnapshotIndicators {
    #[serde(rename = "dolar_blue")]
    pub dolar_blue: Option<SnapshotIndicator>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SnapshotIndicator {
    pub amount: Option<f64>,
    pub compra: Option<f64>,
    pub venta: Option<f64>,
    #[serde(rename = "isMock")]
    pub is_mock: Option<bool>,
}

#[derive(Debug, Clone, Default)]
pub struct BlueQuote {
    pub venta: Option<f64>,
    pub compra: Option<f64>,
}

impl BlueQuote {
    pub fn from_indicator(ind: &SnapshotIndicator) -> Self {
        if ind.is_mock == Some(true) {
            return Self::default();
        }
        // Stored amount is the sell side. Compra is separate and often absent — do not invent it.
        Self {
            venta: ind.venta.or(ind.amount),
            compra: ind.compra,
        }
    }
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
        let q = BlueQuote::from_indicator(&SnapshotIndicator {
            amount: Some(1545.0),
            compra: None,
            venta: None,
            is_mock: Some(false),
        });
        assert_eq!(q.venta, Some(1545.0));
        assert_eq!(q.compra, None);
    }

    #[test]
    fn mock_is_dropped() {
        let q = BlueQuote::from_indicator(&SnapshotIndicator {
            amount: Some(1.0),
            compra: Some(1.0),
            venta: Some(1.0),
            is_mock: Some(true),
        });
        assert!(q.venta.is_none());
    }
}
