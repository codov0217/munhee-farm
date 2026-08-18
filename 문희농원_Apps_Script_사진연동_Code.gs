const SHEET_NAME = '작업기록';
const PHOTO_FOLDER_NAME = '문희농원 작업사진';
const WEATHER_SHEET_NAME = '괴산 청천면 날씨';
// 청천면 중심 부근 좌표입니다. Open-Meteo 공개 날씨 자료를 사용하며 별도 API 키가 필요 없습니다.
const CHEONGCHEON_LATITUDE = 36.6535;
const CHEONGCHEON_LONGITUDE = 127.6500;
const HEADERS = [
  '기록ID', '작업일', '필지', '작목', '작업종류', '작업자',
  '작업량', '메모', '사진링크', '등록일', '최종수정일', '삭제여부',
  '날씨', '기온(℃)', '습도(%)'
];

function doGet() {
  try {
    return response_({ ok: true, records: getRecords_() });
  } catch (error) {
    return response_({ ok: false, message: error.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.action === 'save') saveRecord_(data.record || {});
    else if (data.action === 'saveWithPhotos') {
      return response_({ ok: true, record: saveRecordWithPhotos_(data.record || {}, data.photoDataUrls || []) });
    }
    else if (data.action === 'delete') deleteRecord_(data.record && data.record.recordUid);
    else if (data.action === 'uploadPhoto') {
      return response_({ ok: true, url: uploadPhoto_(data.photo || {}) });
    } else if (data.action === 'translateVietnamese') {
      return response_({ ok: true, ...translateVietnamese_(data.text) });
    } else {
      throw new Error('알 수 없는 요청입니다.');
    }
    return response_({ ok: true });
  } catch (error) {
    return response_({ ok: false, message: error.message });
  }
}

function translateVietnamese_(text) {
  const source = String(text || '').trim();
  if (!source) throw new Error('번역할 오늘 할 일을 입력해 주세요.');
  if (source.length > 1500) throw new Error('한 번에 1,500자까지 번역할 수 있습니다.');
  const translation = LanguageApp.translate(source, 'ko', 'vi');
  return {
    translation: translation,
    backTranslation: LanguageApp.translate(translation, 'vi', 'ko')
  };
}

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#2f6f4e').setFontColor('#ffffff').setFontWeight('bold');
    sheet.autoResizeColumns(1, HEADERS.length);
  } else {
    // 기존 작업일지는 보존한 채, 새 날씨·기온·습도 열만 뒤에 추가합니다.
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
    if (currentHeaders.length < HEADERS.length || currentHeaders[12] !== HEADERS[12]) {
      sheet.getRange(1, 13, 1, 3).setValues([HEADERS.slice(12)]);
      sheet.getRange(1, 13, 1, 3).setBackground('#2f6f4e').setFontColor('#ffffff').setFontWeight('bold');
    }
  }
  return sheet;
}

function getRecords_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(row => String(row[11]).toUpperCase() !== 'Y')
    .map(row => ({
      recordUid: String(row[0] || ''), workDate: dateText_(row[1]),
      field: String(row[2] || ''), crop: String(row[3] || ''),
      work: String(row[4] || ''), worker: String(row[5] || ''),
      amount: String(row[6] || ''), memo: String(row[7] || ''),
      photos: parsePhotos_(row[8]), createdAt: dateTimeText_(row[9]),
      updatedAt: dateTimeText_(row[10]), weather: String(row[12] || ''),
      temperature: String(row[13] || ''), humidity: String(row[14] || '')
    }))
    .sort((a, b) => (b.workDate + b.createdAt).localeCompare(a.workDate + a.createdAt));
}

function saveRecord_(record) {
  if (!record.recordUid) throw new Error('기록ID가 없습니다.');
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String) : [];
  const index = ids.indexOf(String(record.recordUid));
  const now = new Date().toISOString();
  const row = [[
    record.recordUid, record.workDate || '', record.field || '', record.crop || '',
    record.work || '', record.worker || '', record.amount || '', record.memo || '',
    JSON.stringify(record.photos || []), record.createdAt || now, now, '',
    record.weather || '', record.temperature || '', record.humidity || ''
  ]];
  if (index >= 0) {
    const sheetRow = index + 2;
    row[0][9] = sheet.getRange(sheetRow, 10).getValue() || row[0][9];
    sheet.getRange(sheetRow, 1, 1, HEADERS.length).setValues(row);
  } else {
    sheet.getRange(lastRow + 1, 1, 1, HEADERS.length).setValues(row);
  }
}

// 작업기록과 새 사진을 같은 요청으로 처리합니다. 둘 중 하나라도 실패하면 앱에는
// 성공으로 표시되지 않으므로, "기록만 저장되고 사진은 누락"되는 일을 막습니다.
function saveRecordWithPhotos_(record, photoDataUrls) {
  if (!record.recordUid) throw new Error('기록ID가 없습니다.');
  const existing = Array.isArray(record.photos) ? record.photos.filter(String) : [];
  const uploads = Array.isArray(photoDataUrls) ? photoDataUrls : [];
  if (uploads.length > 3) throw new Error('사진은 작업당 최대 3장입니다.');
  const newUrls = uploads.map((dataUrl, index) => uploadPhoto_({
    dataUrl: dataUrl,
    workDate: record.workDate,
    index: existing.length + index + 1,
    recordUid: record.recordUid
  }));
  const saved = Object.assign({}, record, { photos: existing.concat(newUrls) });
  saveRecord_(saved);
  saved.updatedAt = new Date().toISOString();
  return saved;
}

function deleteRecord_(recordUid) {
  if (!recordUid) throw new Error('기록ID가 없습니다.');
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
  const index = ids.indexOf(String(recordUid));
  if (index >= 0) sheet.getRange(index + 2, 12).setValue('Y');
}

function uploadPhoto_(photo) {
  const dataUrl = String(photo.dataUrl || '');
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('사진 형식을 확인할 수 없습니다.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('사진 용량이 너무 큽니다. 다시 촬영해 주세요.');
  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const date = String(photo.workDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  const index = Number(photo.index || 1);
  const recordUid = String(photo.recordUid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(-20);
  const filename = `${date}_${recordUid || '작업'}_사진${index}_${Date.now()}.${extension}`;
  const file = getPhotoFolder_().createFile(Utilities.newBlob(bytes, mimeType, filename));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // 앱 목록에서는 파일 응답 주소보다 썸네일 전용 주소가 휴대폰에서 안정적으로 표시됩니다.
  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`;
}

function getPhotoFolder_() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

// 처음 한 번 수동 실행하면 이후에는 매일 오전 7시 전후 자동으로 기록합니다.
function 자동날씨기록시작() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === '기록괴산청천면날씨')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('기록괴산청천면날씨').timeBased().everyDays(1).atHour(7).create();
  기록괴산청천면날씨();
}

function 기록괴산청천면날씨() {
  const timezone = Session.getScriptTimeZone() || 'Asia/Seoul';
  const today = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  const sheet = getWeatherSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const recordedDates = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    if (recordedDates.includes(today)) return;
  }
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CHEONGCHEON_LATITUDE +
    '&longitude=' + CHEONGCHEON_LONGITUDE +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum' +
    '&timezone=Asia%2FSeoul&forecast_days=1';
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('날씨 정보를 가져오지 못했습니다.');
  const daily = JSON.parse(response.getContentText()).daily;
  sheet.appendRow([
    today, weatherText_(daily.weather_code[0]), daily.temperature_2m_min[0], daily.temperature_2m_max[0],
    daily.relative_humidity_2m_mean[0], daily.precipitation_sum[0], new Date()
  ]);
}

function getWeatherSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(WEATHER_SHEET_NAME) || ss.insertSheet(WEATHER_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜', '날씨', '최저기온(℃)', '최고기온(℃)', '평균습도(%)', '강수량(mm)', '기록시각']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 7).setBackground('#2f6f4e').setFontColor('#ffffff').setFontWeight('bold');
    sheet.autoResizeColumns(1, 7);
  }
  return sheet;
}

function weatherText_(code) {
  const labels = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개',
    51: '이슬비', 53: '이슬비', 55: '이슬비', 56: '어는 이슬비', 57: '어는 이슬비',
    61: '비', 63: '비', 65: '강한 비', 66: '어는 비', 67: '어는 비', 71: '눈', 73: '눈', 75: '강한 눈',
    77: '싸락눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈 소나기', 86: '강한 눈 소나기',
    95: '뇌우', 96: '우박 동반 뇌우', 99: '강한 우박 동반 뇌우' };
  return labels[Number(code)] || '기타';
}

function parsePhotos_(value) {
  try { const photos = JSON.parse(value || '[]'); return Array.isArray(photos) ? photos : []; }
  catch (e) { return []; }
}
function dateText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value))
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value || '');
}
function dateTimeText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value.toISOString();
  return String(value || '');
}
