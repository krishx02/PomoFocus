// PomoFocus Device Firmware — E-ink Display Manager
// See display.h for interface documentation.
// See ADR-010 for hardware platform details.
//
// Pin mapping notes:
// The EN04 board routes XIAO nRF52840 pins to the 24-pin FPC e-ink connector.
// Since the PlatformIO board definition uses the Feather nRF52840 Express
// variant (no official XIAO variant exists in the Adafruit BSP), Arduino pin
// numbers do not match XIAO Dx labels. We map through nRF52840 GPIO numbers:
//
//   Function   XIAO pin   nRF52840 GPIO   Feather Arduino pin
//   --------   --------   -------------   -------------------
//   SPI MOSI   D1         P0.03           19 (A5)
//   SPI SCK    D2         P0.28           17 (A3)
//   EPD CS     D3         P0.29           20 (A6)
//   EPD DC     D0         P0.02           18 (A4)
//   EPD RST    D8         P1.13           — (not in Feather map)
//   EPD BUSY   D10        P0.15           24 (SPI MISO)
//
// EPD_RST (P1.13) is absent from the Feather variant's g_ADigitalPinMap,
// so GxEPD2 cannot use digitalWrite on it. We toggle RST manually via the
// nRF GPIO HAL before init, and pass rst=-1 to GxEPD2.

#include "display.h"

#include <GxEPD2_BW.h>
#include <gdeq/GxEPD2_426_GDEQ0426T82.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <nrf_gpio.h>

// ---------- Pin definitions (Feather variant Arduino pin numbers) ----------
// These are indices into g_ADigitalPinMap that resolve to the correct
// nRF52840 GPIOs used by the EN04 board's FPC connector.

constexpr int16_t EPD_CS_PIN   = 20;  // Feather D20/A6 → P0.29 → XIAO D3
constexpr int16_t EPD_DC_PIN   = 18;  // Feather D18/A4 → P0.02 → XIAO D0
constexpr int16_t EPD_BUSY_PIN = 24;  // Feather D24/MISO → P0.15 → XIAO D10

// EPD RST is on P1.13 (XIAO D8), not in Feather variant map.
// Managed via nrf_gpio HAL — not passed to GxEPD2.
constexpr uint32_t EPD_RST_GPIO = NRF_GPIO_PIN_MAP(1, 13);

// SPI pin remapping (Feather variant Arduino pin numbers)
constexpr uint8_t SPI_MISO_PIN = 24;  // Feather D24 → P0.15 (shared with BUSY, unused by SPI)
constexpr uint8_t SPI_SCK_PIN  = 17;  // Feather D17/A3 → P0.28 → XIAO D2
constexpr uint8_t SPI_MOSI_PIN = 19;  // Feather D19/A5 → P0.03 → XIAO D1

// ---------- Display buffer sizing ----------
// GxEPD2_BW uses paged drawing. Page height determines RAM usage:
// buffer = WIDTH/8 * page_height = 100 * page_height bytes.
// 20 rows → 2000 bytes. 24 pages for full 480-row screen.
constexpr uint16_t PAGE_HEIGHT = 20;

// ---------- Display instance ----------
// GxEPD2_BW wraps the panel driver with Adafruit_GFX for text/graphics.
// rst=-1 because we handle RST manually (P1.13 not in variant map).
static GxEPD2_BW<GxEPD2_426_GDEQ0426T82, PAGE_HEIGHT> display(
    GxEPD2_426_GDEQ0426T82(EPD_CS_PIN, EPD_DC_PIN, /*rst=*/-1, EPD_BUSY_PIN));

// Hardware reset of the display controller via nRF GPIO HAL.
// Pulse RST low for 10ms, then wait 10ms for controller startup.
static void hardwareReset() {
    nrf_gpio_cfg_output(EPD_RST_GPIO);
    nrf_gpio_pin_set(EPD_RST_GPIO);
    delay(10);
    nrf_gpio_pin_clear(EPD_RST_GPIO);
    delay(10);
    nrf_gpio_pin_set(EPD_RST_GPIO);
    delay(10);
}

namespace Display {

void init() {
    // Remap SPI to the EN04 board's FPC-connected pins before GxEPD2
    // calls SPI.begin(). The Feather variant defaults (P0.13/P0.14/P0.15)
    // do not match the EN04's internal routing.
    SPI.setPins(SPI_MISO_PIN, SPI_SCK_PIN, SPI_MOSI_PIN);

    // Toggle RST manually since GxEPD2 cannot reach P1.13.
    hardwareReset();

    // Initialize the GxEPD2 driver. The second parameter (initial=true)
    // tells the driver this is a cold start — it will do a full
    // controller init rather than a partial wake-from-sleep.
    display.init(115200, true);

    // Landscape orientation: rotation 0 is default (800 wide x 480 tall).
    display.setRotation(0);

    Serial.println("Display initialized");
}

void clear() {
    // Full refresh to blank white. clearScreen writes 0xFF (white) to the
    // entire controller memory and triggers a full refresh cycle (~1.6s).
    display.clearScreen(0xFF);
    Serial.println("Display cleared");
}

void hibernate() {
    // Put the SSD1677 controller into deep sleep. Current draw drops to
    // near zero. Requires a hardware reset to wake — call init() again.
    // Note: GxEPD2 hibernate() is a no-op when rst < 0, so we call
    // powerOff() instead which turns off panel driving voltages.
    display.powerOff();
    Serial.println("Display powered off");
}

void showTestPattern() {
    // Use paged drawing to render centered "PomoFocus" text.
    // Paged drawing keeps RAM usage low: only PAGE_HEIGHT rows buffered.
    display.setTextColor(GxEPD_BLACK);
    display.setFont(nullptr);  // default Adafruit GFX 5x7 font
    display.setTextSize(5);    // 5x scale → 25x35 pixel characters

    // "PomoFocus" = 9 characters × 30px wide (5×5 + 5px spacing) = ~270px
    // Centered on 800×480: x = (800 - 270) / 2 ≈ 265, y = (480 - 35) / 2 ≈ 222
    constexpr int16_t TEXT_X = 265;
    constexpr int16_t TEXT_Y = 222;

    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        display.setCursor(TEXT_X, TEXT_Y);
        display.print("PomoFocus");
    } while (display.nextPage());

    Serial.println("Test pattern displayed");
}

} // namespace Display
