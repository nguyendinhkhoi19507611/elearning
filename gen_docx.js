const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, VerticalAlign
} = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text, width) {
  return new TableCell({
    borders: headerBorders, width: { size: width, type: WidthType.DXA },
    shading: { fill: "DDDDDD", type: ShadingType.CLEAR }, margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "000000", size: 20, font: "Arial" })] })]
  });
}
function dataCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text: text || "", size: 20, font: "Arial" })] })]
  });
}
function dataCellBold(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text: text || "", size: 20, font: "Arial", bold: true })] })]
  });
}
function h1(t){return new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:360,after:120},children:[new TextRun({text:t,font:"Arial",size:36,bold:true,color:"000000"})]});}
function h2(t){return new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:240,after:100},children:[new TextRun({text:t,font:"Arial",size:28,bold:true,color:"000000"})]});}
function h3(t){return new Paragraph({heading:HeadingLevel.HEADING_3,spacing:{before:200,after:80},children:[new TextRun({text:t,font:"Arial",size:24,bold:true,color:"000000"})]});}
function para(t){return new Paragraph({spacing:{after:120},children:[new TextRun({text:t,font:"Arial",size:20})]});}
function boldPara(l,t){return new Paragraph({spacing:{after:100},children:[new TextRun({text:l,font:"Arial",size:20,bold:true}),new TextRun({text:t,font:"Arial",size:20})]});}
function codePara(t){return new Paragraph({spacing:{before:80,after:80},indent:{left:720},children:[new TextRun({text:t,font:"Courier New",size:18,color:"C7254E"})]});}
function spacer(){return new Paragraph({children:[new TextRun("")],spacing:{after:80}});}
function bullet(t){return new Paragraph({numbering:{reference:"bullets",level:0},children:[new TextRun({text:t,font:"Arial",size:20})]});}

function makeTable(headers, widths, rows, boldCol) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h,i) => headerCell(h, widths[i])) }),
      ...rows.map(row => new TableRow({
        children: row.map((cell, ci) => (boldCol && boldCol.includes(ci) ? dataCellBold : dataCell)(cell, widths[ci]))
      }))
    ]
  });
}

const table1 = makeTable(["Thành phần","Mô hình / Công nghệ","Mục đích"],[2000,3500,3860],[
  ["AI Vision","YOLOv11 + OpenCV","Nhận diện trạng thái sinh viên (tập trung, buồn ngủ, vắng, dùng điện thoại)"],
  ["AI Recommendation","Neural Collaborative Filtering (NCF)","Gợi ý bài học cá nhân hóa"],
  ["AI Behavior","DNN Classifier","Phân tích mức độ gắn kết học tập (Engagement Level)"],
  ["AI Voice","SpeechBrain","Xác thực danh tính qua giọng nói"],
]);

const table21 = makeTable(["#","Nguyên nhân","Giải thích","Mức độ"],[400,2000,5060,1900],[
  ["1","Điều kiện ánh sáng","Thiếu sáng, ngược sáng hoặc ánh sáng nhấp nháy làm mất nét khuôn mặt → không nhận diện được","Cao"],
  ["2","Góc quay camera","Sinh viên để camera quá thấp/cao, hoặc quay nửa mặt → OpenCV không nhận diện được frontalface","Cao"],
  ["3","Vật cản (Occlusion)","Sinh viên đeo khẩu trang, kính râm, hoặc tóc che mắt → nhầm lẫn trạng thái (VD: tưởng nhắm mắt / buồn ngủ)","Trung bình"],
  ["4","Nhầm lẫn hành vi","Cúi xuống ghi chép bài có thể bị YOLO nhầm thành 'buồn ngủ' (drowsy) hoặc 'dùng điện thoại'","Trung bình"],
],[1]);

const table22 = makeTable(["#","Nguyên nhân","Giải thích","Mức độ"],[400,2000,5060,1900],[
  ["1","Cold-start problem","Sinh viên mới hoặc bài học mới chưa có lịch sử tương tác. Mô hình phải đoán mò → sai lệch cao","Cao"],
  ["2","Data sparsity","Dữ liệu tương tác giữa SV-bài học quá thưa thớt, không đủ để học Embedding chính xác","Cao"],
  ["3","Bias độ khó","Hệ thống thiên vị gợi ý các bài học dễ (có nhiều người qua) cho tất cả mọi người","Trung bình"],
  ["4","Sự thay đổi đột ngột","Khả năng của SV đột ngột tăng lên (học offline) nhưng NCF chưa kịp cập nhật trọng số","Trung bình"],
],[1]);

const table23 = makeTable(["#","Nguyên nhân","Giải thích","Mức độ"],[400,2000,5060,1900],[
  ["1","Fake engagement","SV treo máy, mở tab để đó nhưng không thực sự học → DNN vẫn tính là có thời gian học cao","Cao"],
  ["2","Thiếu feature ngữ cảnh","Không phân biệt được SV đọc tài liệu lâu vì khó hiểu (cần giúp đỡ) hay vì tập trung cao độ","Trung bình"],
  ["3","Mất cân bằng dữ liệu","Đa số SV nằm ở mức Medium/High, rất ít SV At_risk → DNN dễ đoán nhầm nhóm At_risk thành Low","Cao"],
],[1]);

const table24 = makeTable(["#","Nguyên nhân","Giải thích","Mức độ"],[400,2000,5060,1900],[
  ["1","Nhiễu nền (Background Noise)","Tiếng quạt, tiếng ồn ngoài đường, tạp âm làm méo đặc trưng MFCC của giọng nói","Cao"],
  ["2","Chất lượng Microphone","Mic rẻ tiền, bị rè, khoảng cách nói quá xa hoặc quá gần gây vỡ tiếng (clipping)","Trung bình"],
  ["3","Thay đổi giọng sinh lý","SV bị ốm, cảm cúm, khản tiếng hoặc vừa ngủ dậy → SpeechBrain từ chối xác thực (False Rejection)","Trung bình"],
],[1]);

const table3 = makeTable(["Mô hình AI","Lỗi phổ biến nhất","Accuracy dự kiến","Điều kiện tối ưu"],[2000,2500,2000,2860],[
  ["AI Vision","Nhầm cúi mặt thành buồn ngủ","80% - 85%","Đủ sáng, góc cam thẳng mặt"],
  ["AI Recommendation","Gợi ý sai do Cold-start","70% - 75%","> 10 bài học/sinh viên"],
  ["AI Behavior","Đánh giá sai do treo máy","75% - 80%","SV tương tác liên tục (click, scroll)"],
  ["AI Voice","Khước từ sai do tiếng ồn","85% - 90%","Môi trường yên tĩnh, mic tốt"],
],[0]);

const table5 = makeTable(["#","Đề xuất","Ưu tiên","Mô tả"],[400,2500,1200,5260],[
  ["1","Active Liveness Detection","Cao","(Vision) Yêu cầu chớp mắt/quay đầu để chống dùng ảnh giả điểm danh"],
  ["2","Cross-validation","Cao","(Behavior) Kết hợp điểm số thực tế với thời gian học để loại bỏ fake engagement"],
  ["3","Hybrid Recommendation","TB","(Recommendation) Kết hợp NCF với Content-based để giảm ảnh hưởng của data sparsity"],
  ["4","Multi-modal Authentication","TB","Kết hợp đồng thời Voice và Face để tăng tỷ lệ xác thực thành công"],
],[1]);

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1F3864" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E74B5" },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2E74B5" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { after: 80 } }, run: { font: "Arial", size: 20 } } }] }]
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: "PHÂN TÍCH SAI SỐ DỰ ĐOÁN", font: "Arial", size: 44, bold: true, color: "1F3864" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 480 },
        children: [new TextRun({ text: "CỦA CÁC MÔ HÌNH AI TRONG HỆ THỐNG", font: "Arial", size: 44, bold: true, color: "1F3864" })] }),

      h1("1. TỔNG QUAN CÁC MÔ HÌNH AI"),
      para("Hệ thống E-Learning tích hợp 4 mô hình/công nghệ AI chính nhằm phục vụ nhiều mục đích khác nhau. Mỗi mô hình đều có nguy cơ xảy ra sai số trong quá trình nhận diện và dự đoán:"),
      spacer(), table1, spacer(),

      h1("2. CÁC LOẠI SAI SỐ DỰ ĐOÁN THEO TỪNG MÔ HÌNH"),
      
      h2("2.1. Sai số AI Vision (YOLOv11 + OpenCV)"),
      boldPara("Mô tả: ","Nhận diện trạng thái khuôn mặt và hành vi qua webcam."),
      h3("Nguyên nhân sai:"), spacer(), table21, spacer(),

      h2("2.2. Sai số AI Recommendation (NCF)"),
      boldPara("Mô tả: ","Gợi ý lộ trình và bài học sử dụng Neural Collaborative Filtering."),
      h3("Nguyên nhân sai:"), spacer(), table22, spacer(),

      h2("2.3. Sai số AI Behavioral Analytics (DNN Classifier)"),
      boldPara("Mô tả: ","Phân loại mức độ gắn kết (High, Medium, Low, At_risk)."),
      h3("Nguyên nhân sai:"), spacer(), table23, spacer(),

      h2("2.4. Sai số AI Voice (SpeechBrain)"),
      boldPara("Mô tả: ","Xác thực giọng nói khi tham gia lớp học hoặc điểm danh."),
      h3("Nguyên nhân sai:"), spacer(), table24, spacer(),

      h1("3. BẢNG TỔNG HỢP SAI SỐ VÀ ĐỘ CHÍNH XÁC KỲ VỌNG"), spacer(), table3, spacer(),

      h1("4. CÁC BIỆN PHÁP GIẢM SAI SỐ ĐÃ ÁP DỤNG"),
      h2("4.1. Cơ chế Fallback và Ngưỡng tin cậy (Confidence Threshold)"),
      bullet("Vision & Voice: Đặt ngưỡng confidence > 50% cho YOLO và similarity_score > 0.65 cho SpeechBrain. Nếu dưới ngưỡng, yêu cầu thử lại hoặc chuyển sang xác thực thủ công."),
      bullet("Recommendation: Khi gặp Cold-start, fallback về gợi ý dựa trên Rule-based (các bài học phổ biến nhất của môn)."), spacer(),
      
      h2("4.2. Xử lý dữ liệu và Chống nhiễu"),
      bullet("Voice: Áp dụng bộ lọc nhiễu (noise reduction) sơ bộ trước khi đẩy vào Librosa/SpeechBrain."),
      bullet("Behavior: Lọc bỏ các session có time_spent quá dài bất thường (nghi ngờ treo máy) trước khi đưa vào training DNN."), spacer(),

      h1("5. ĐỀ XUẤT CẢI THIỆN TRONG TƯƠNG LAI"), spacer(), table5, spacer(),

      h1("6. KẾT LUẬN"),
      para("Hệ thống đã tích hợp 4 mô hình AI phục vụ các mục đích độc lập. Dù mỗi mô hình đối mặt với những loại sai số đặc thù (nhiễu vật lý đối với Vision/Voice, hoặc thiếu hụt dữ liệu đối với NCF/Behavior), việc thiết lập ngưỡng tin cậy (confidence threshold) và cơ chế dự phòng (fallback) giúp hệ thống vẫn duy trì hoạt động ổn định và mang lại giá trị thực tiễn cao cho trải nghiệm E-Learning."),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("d:/AI/elearning/AI_Prediction_Error_Analysis.docx", buffer);
  console.log("Done! File saved to d:/AI/elearning/AI_Prediction_Error_Analysis.docx");
}).catch(err => console.error("Error:", err));
