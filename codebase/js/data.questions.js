/* =====================================================================
 * NGÂN HÀNG CÂU HỎI — chuyển từ File_Tu_lam/golden_set.md (20 câu, answer key
 * 1B 2B 3B 4A 5A 6B 7B 8B 9A 10B 11A 12B 13B 14A 15A 16B 17A 18B 19B 20C).
 *
 * Mỗi câu có:
 *  - reference: lời giải thích mẫu cho 3 persona (do nhóm viết) — dùng làm
 *    (a) đáp án tham chiếu khi chấm golden set, (b) nội dung cho chế độ MOCK.
 *  - anchors: mã đoạn transcript [Txx-NNN] thật trong data/vlearn-pack/transcript
 *    mà AI ĐƯỢC PHÉP trích dẫn. anchor_confidence:
 *      "strong"  — transcript nói trực tiếp về khái niệm
 *      "partial" — chỉ chạm tới, phải trích dẫn dè dặt
 *      "none"    — transcript KHÔNG có → AI phải nói "chưa có trong tài liệu
 *                  buổi này", KHÔNG được bịa mã đoạn (lớp ① Nguồn sự thật).
 *  - concept: {title, summary, draft} — "Kiến thức đang luyện" ở sidebar. BẢN NHÁP do
 *    Claude soạn từ reference + anchors; nhóm review rồi đổi draft:false.
 * ===================================================================== */
window.QUESTION_BANK = [
  {
    id: "Q01", topic: "LLM và kiến thức nội bộ", difficulty: "Dễ",
    stem: "Một công ty muốn dùng LLM để trả lời câu hỏi về chính sách nội bộ. Vì sao chỉ sử dụng một LLM pretrained mà không cung cấp thêm dữ liệu công ty có thể chưa đủ?",
    options: {
      A: "LLM chỉ xử lý được dữ liệu dạng số",
      B: "LLM không nhất thiết có kiến thức riêng và cập nhật về chính sách nội bộ của công ty",
      C: "LLM không thể tạo văn bản mới",
      D: "LLM bắt buộc phải kết nối Internet mới hoạt động"
    },
    correct: "B",
    reference: {
      nonit: "LLM giống một người đã đọc rất nhiều sách trước khi vào công ty, nhưng chưa chắc đã đọc quy định nội bộ mới nhất. Muốn nó trả lời đúng, cần cho nó tham khảo tài liệu của chính công ty.",
      dev: "LLM pretrained có knowledge nằm trong model weights nhưng không tự truy cập private/current data của doanh nghiệp. Application thường phải bổ sung context từ database, API hoặc RAG trước khi gọi LLM.",
      dataai: "Pretraining giúp LLM học patterns và knowledge từ training corpus nhưng không đảm bảo coverage hay freshness với private domain knowledge. Có thể cần grounding bằng external context như RAG hoặc các kỹ thuật adaptation khác."
    },
    anchors: [
      { code: "T06-148", quote: "Bất lợi đầu tiên là knowledge cutoff: bao giờ nó cũng có cái mốc chặn trên về mặt tri thức của nhân loại được input vào." },
      { code: "T06-147", quote: "Một trong những lý do dẫn đến hallucination nữa là nó bị cutoff." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Giới hạn kiến thức của LLM", summary: "Kiến thức của LLM dừng ở thời điểm huấn luyện (knowledge cutoff) và không bao gồm dữ liệu riêng của tổ chức. Muốn trả lời đúng về nội dung nội bộ, phải cung cấp tài liệu đó vào ngữ cảnh lúc hỏi.", draft: true }
  },
  {
    id: "Q02", topic: "RAG và Fine-tuning", difficulty: "Dễ",
    stem: "Tài liệu nội bộ của công ty thay đổi hàng tuần. Vì sao RAG thường phù hợp hơn việc fine-tune lại LLM mỗi khi tài liệu thay đổi?",
    options: {
      A: "RAG làm LLM có nhiều parameter hơn",
      B: "RAG có thể lấy thông tin mới tại thời điểm trả lời mà không cần huấn luyện lại model mỗi lần dữ liệu thay đổi",
      C: "RAG không cần sử dụng LLM",
      D: "Fine-tuning không thể áp dụng với dữ liệu văn bản"
    },
    correct: "B",
    reference: {
      nonit: "RAG giống như cho AI mở cuốn sổ tay mới nhất trước khi trả lời. Khi quy định thay đổi, chỉ cần cập nhật cuốn sổ thay vì phải “dạy lại” AI.",
      dev: "Knowledge nằm ngoài model. Flow thường là query → retrieve documents → build prompt → LLM. Khi tài liệu đổi, có thể update knowledge base/index thay vì retrain và redeploy model.",
      dataai: "RAG tách parametric knowledge của model khỏi external knowledge source. Evidence được retrieve tại inference time rồi condition generation trên evidence đó, phù hợp hơn với knowledge có freshness cao."
    },
    anchors: [
      { code: "T03-119", quote: "Các bạn cũng đừng quá [không nghe rõ] cái kỹ thuật gọi là fine-tuning nhá. Tại vì để sử dụng được kỹ thuật fine-tuning, các bạn phải có kinh nghiệm trong việc phát triển model, phải có dữ liệu, phải validate được." },
      { code: "T03-036", quote: "Nãy các bạn bảo là sử dụng RAG — ok, dùng RAG cho một vài cái system nó tốt." }
    ],
    anchor_confidence: "partial",
    concept: { title: "RAG và fine-tuning: khi nào dùng gì", summary: "RAG lấy tài liệu liên quan tại thời điểm trả lời nên cập nhật được ngay khi tài liệu đổi. Fine-tuning ghi kiến thức/hành vi vào trọng số, tốn dữ liệu và công validate, không phù hợp với thông tin thay đổi thường xuyên.", draft: true }
  },
  {
    id: "Q03", topic: "RAG và Hallucination", difficulty: "Trung bình",
    stem: "Một hệ thống RAG đã retrieve đúng tài liệu, nhưng LLM vẫn thêm một con số không xuất hiện trong tài liệu. Điều này cho thấy điều gì?",
    options: {
      A: "RAG đã bị lỗi hoàn toàn",
      B: "Retrieval đúng không đảm bảo phần generation chỉ tạo ra những thông tin được evidence hỗ trợ",
      C: "Vector database không thể dùng với số",
      D: "Khi dùng RAG thì hallucination không thể xảy ra"
    },
    correct: "B",
    reference: {
      nonit: "Giống như đưa đúng tài liệu cho một người đọc nhưng khi trả lời họ vẫn tự nhớ thêm một con số không có trong tài liệu. Có đúng tài liệu chưa chắc đã đảm bảo câu trả lời hoàn toàn đúng.",
      dev: "RAG có các stage khác nhau như retrieval → generation. Retriever có thể trả đúng chunks nhưng LLM vẫn generate unsupported claims, nên application có thể cần citation hoặc verification layer.",
      dataai: "Retrieval relevance và generation faithfulness là hai vấn đề khác nhau. Retriever có thể đạt recall tốt nhưng conditional generation vẫn sinh token sequence không được support bởi retrieved evidence."
    },
    anchors: [
      { code: "T06-138", quote: "LLM có thể sai, và trên thực tế không bao giờ có chuyện đúng 100%." },
      { code: "T04-047", quote: "Nó không phải là nó biết cái tri thức đấy, mà là nó đang dự đoán những từ tiếp theo, hoặc là những token." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Retrieval đúng ≠ generation trung thực", summary: "RAG gồm hai bước tách biệt: tìm tài liệu và sinh câu trả lời. Tìm đúng tài liệu không đảm bảo phần sinh chỉ dùng thông tin trong đó, vì LLM vẫn là mô hình dự đoán token và có thể sai.", draft: true }
  },
  {
    id: "Q04", topic: "Embedding", difficulty: "Trung bình",
    stem: "Trong hệ thống RAG, vì sao câu “Tôi không đăng nhập được” có thể retrieve tài liệu “Hướng dẫn xử lý lỗi authentication” dù hai câu không có nhiều từ giống nhau?",
    options: {
      A: "Embedding có thể biểu diễn sự tương đồng về ngữ nghĩa thay vì chỉ dựa vào exact keyword matching",
      B: "LLM đã ghi nhớ toàn bộ database",
      C: "Vector database tự dịch tất cả câu sang tiếng Anh",
      D: "RAG chỉ tìm kiếm bằng keyword"
    },
    correct: "A",
    reference: {
      nonit: "AI có thể nhận ra hai câu đang nói về cùng một vấn đề dù dùng từ khác nhau. “Không đăng nhập được” và “lỗi authentication” đều liên quan đến việc đăng nhập.",
      dev: "Embedding model encode query và documents thành vectors. Vector DB sau đó chạy similarity search nên không yêu cầu exact keyword match.",
      dataai: "Embedding ánh xạ text vào representation space, nơi semantic similarity được phản ánh qua khoảng cách hoặc similarity giữa vectors, chẳng hạn cosine similarity."
    },
    anchors: [
      { code: "T06-130", quote: "Cứ một từ — đơn giản hóa gọi một từ là một token — thì làm sao mỗi từ đấy chúng ta biểu diễn nó trong không gian..." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Embedding và tương đồng ngữ nghĩa", summary: "Embedding biến câu chữ thành vector sao cho câu cùng ý nằm gần nhau, dù dùng từ khác. Nhờ vậy truy hồi theo nghĩa thay vì chỉ khớp từ khoá.", draft: true }
  },
  {
    id: "Q05", topic: "Context Window", difficulty: "Trung bình",
    stem: "Một request gửi vào LLM gồm: System prompt 2K tokens · Chat history 6K tokens · Retrieved documents 5K tokens · Expected output 3K tokens. Model có context window 16K. Vì sao tiếp tục thêm tài liệu retrieval có thể gây vấn đề?",
    options: {
      A: "Prompt, history, context và phần output cần sinh đều cạnh tranh trong giới hạn context của model",
      B: "LLM chỉ cho phép một retrieved document",
      C: "RAG không thể hoạt động cùng chat history",
      D: "Context window chỉ tính output token"
    },
    correct: "A",
    reference: {
      nonit: "Context window giống bàn làm việc của AI. Lịch sử chat, tài liệu và câu trả lời đều cần chỗ trên chiếc bàn đó. Đặt quá nhiều tài liệu lên bàn sẽ khiến không còn đủ chỗ cho phần khác.",
      dev: "Application phải quản lý token budget giữa system prompt, messages, retrieved context và generation. Khi gần context limit có thể cần truncate, summarize hoặc giảm số chunks retrieve.",
      dataai: "Context window giới hạn sequence model có thể condition trên. Retrieval thêm token không chỉ chiếm sequence budget mà còn có thể tăng context dilution và inference cost."
    },
    anchors: [
      { code: "T04-051", quote: "Context ở đây nghĩa là gì? Là toàn bộ những thông tin mà một mô hình nó có thể tiêu thụ trong một lần." },
      { code: "T04-052", quote: "Context rot: khi bạn càng đưa nhiều thông tin, càng đưa nhiều ngữ cảnh, thì cái mô hình càng ngày về sau nó sẽ càng kém đi, và nó sẽ thường quên những thông tin ở lúc đầu." },
      { code: "T06-149", quote: "Cái thứ ba là context window: mô hình chỉ nhìn được một lượng nhất định." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Context window là ngân sách chung", summary: "Mọi thứ đưa vào một lượt gọi (system prompt, lịch sử, tài liệu truy hồi) và cả phần trả lời đều chia chung một giới hạn token. Nhồi thêm tài liệu làm hết chỗ cho phần khác và mô hình dễ 'quên' đầu ngữ cảnh (context rot).", draft: true }
  },
  {
    id: "Q06", topic: "Tokenization", difficulty: "Dễ",
    stem: "Hai prompt truyền tải gần như cùng lượng thông tin, một bằng tiếng Việt và một bằng tiếng Anh, nhưng số token khác nhau. Nguyên nhân hợp lý nhất là gì?",
    options: {
      A: "Một từ luôn tương ứng với một token",
      B: "Tokenizer chia văn bản thành các đơn vị phụ thuộc vào chuỗi ký tự, ngôn ngữ và cách biểu diễn",
      C: "Tiếng Việt không sử dụng tokenizer",
      D: "Context window được tính bằng số từ"
    },
    correct: "B",
    reference: {
      nonit: "AI không đọc văn bản chính xác theo từng “từ” như con người. Một từ có thể bị chia thành nhiều mảnh nhỏ, vì vậy hai câu dài tương đương vẫn có số token khác nhau.",
      dev: "Tokenizer encode raw string thành sequence các token ID. Language, punctuation, code và formatting khác nhau có thể tạo segmentation khác nhau.",
      dataai: "Tokenization ánh xạ text sang discrete subword units theo vocabulary của model. Segmentation efficiency khác nhau giữa languages/domains, ảnh hưởng sequence length và computational cost."
    },
    anchors: [
      { code: "T04-049", quote: "Token — nó sẽ là một đơn vị tính — nó không phải là từ, không phải là chữ cái, mà nó là token." },
      { code: "T06-134", quote: "Đơn vị cơ bản của LLM là cái nãy giờ chúng ta gọi là token. Quá trình huấn luyện dữ liệu đầu vào trước đây chủ yếu dùng tiếng Anh." },
      { code: "T06-135", quote: "Cái LLM nó không đọc ký tự các bạn nhá... không đọc ký tự trái sang phải, cũng không đọc word by word." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Token không phải từ", summary: "LLM xử lý văn bản theo token, đơn vị nhỏ hơn hoặc khác với từ. Cách tách phụ thuộc tokenizer và ngôn ngữ; tiếng Việt thường tốn nhiều token hơn tiếng Anh cho cùng nội dung.", draft: true }
  },
  {
    id: "Q07", topic: "Temperature", difficulty: "Dễ",
    stem: "Một LLM được chạy nhiều lần với cùng prompt nhưng đôi lúc diễn đạt câu trả lời khác nhau. Nếu muốn output ổn định hơn, thay đổi nào hợp lý nhất?",
    options: {
      A: "Tăng temperature",
      B: "Giảm temperature, nhưng không coi điều đó là đảm bảo câu trả lời đúng",
      C: "Tăng embedding dimension",
      D: "Giảm context window"
    },
    correct: "B",
    reference: {
      nonit: "Temperature có thể hiểu như mức độ “tự do” khi AI lựa chọn cách nói. Giảm nó khiến AI thiên về các lựa chọn quen thuộc hơn nên kết quả thường ổn định hơn, nhưng vẫn có thể trả lời sai.",
      dev: "Temperature là generation parameter. Lower temperature làm token distribution tập trung hơn nên API output thường ít biến thiên hơn, nhưng factual correctness vẫn phải evaluate riêng.",
      dataai: "Temperature rescale logits trước sampling. Với T<1, probability mass thường tập trung hơn vào high-logit tokens và entropy giảm, nhưng maximum-likelihood generation không đồng nghĩa truthfulness."
    },
    anchors: [
      { code: "T04-072", quote: "Nếu temperature bằng 0, mô hình sẽ luôn luôn lấy xác suất cao nhất... Nhưng khi bạn tăng temperature lên, nó sẽ random rộng hơn trong phạm vi đấy." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Temperature điều khiển độ ngẫu nhiên", summary: "Temperature thấp khiến mô hình thiên về token xác suất cao nhất nên kết quả ổn định hơn giữa các lần chạy. Ổn định không đồng nghĩa với đúng sự thật.", draft: true }
  },
  {
    id: "Q08", topic: "Transformer và Attention", difficulty: "Khó",
    stem: "Trong Transformer, vai trò chính của self-attention là gì?",
    options: {
      A: "Lưu toàn bộ conversation vào database",
      B: "Cho phép representation của một token được xây dựng dựa trên mức độ liên quan với các token khác trong context",
      C: "Kiểm tra thông tin trên Internet có đúng không",
      D: "Chuyển token thành API request"
    },
    correct: "B",
    reference: {
      nonit: "Khi đọc một câu, bạn thường chú ý đến những từ liên quan để hiểu một từ đang nói về điều gì. Attention giúp AI làm điều tương tự: xác định phần nào trong câu đáng chú ý hơn.",
      dev: "Transformer tạo Query, Key và Value từ token representations. Query được so với Keys để tạo attention weights, sau đó dùng weights để aggregate Values.",
      dataai: "Self-attention tính compatibility giữa Q và K, thường bằng scaled dot-product, softmax thành attention distribution rồi dùng distribution đó để weighted-sum V."
    },
    anchors: [
      { code: "T06-086", quote: "Cái self-attention bản chất là mỗi một token sẽ nhìn các token khác trong ngữ cảnh đang đặt ra." },
      { code: "T06-130", quote: "Cái cơ chế self-attention ở đây, hiểu một cách thân thiện: cứ một từ... thì làm sao mỗi từ đấy chúng ta biểu diễn nó trong không gian." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Self-attention", summary: "Mỗi token 'nhìn' các token khác trong ngữ cảnh và gán trọng số liên quan để xây biểu diễn của chính nó. Đây là cơ chế cốt lõi giúp Transformer hiểu quan hệ giữa các từ.", draft: true }
  },
  {
    id: "Q09", topic: "Fine-tuning + RAG", difficulty: "Trung bình",
    stem: "Một chatbot cần vừa giữ phong cách trả lời chuyên biệt, vừa sử dụng thông tin sản phẩm thay đổi hàng tuần. Architecture nào hợp lý?",
    options: {
      A: "Fine-tuning có thể dùng cho behavior/style ổn định, còn RAG cung cấp knowledge thường xuyên thay đổi",
      B: "Fine-tune lại model mỗi ngày để ghi nhớ tài liệu",
      C: "Chỉ tăng temperature",
      D: "Chỉ sử dụng vector database, không cần LLM"
    },
    correct: "A",
    reference: {
      nonit: "Fine-tuning giống đào tạo nhân viên cách nói chuyện và làm việc. RAG giống đưa cho họ tài liệu mới nhất để tra cứu. Hai thứ giải quyết hai nhu cầu khác nhau.",
      dev: "Fine-tuning thay đổi model behavior thông qua weights, còn product documents nằm trong retrieval layer. Khi dữ liệu đổi chỉ cần update knowledge base/index.",
      dataai: "Fine-tuning thực hiện parameter adaptation, còn RAG cung cấp non-parametric external knowledge tại inference time. Tách hai cơ chế giúp stable behavior và changing knowledge được quản lý riêng."
    },
    anchors: [
      { code: "T03-119", quote: "Nếu đụng đến fine-tuning, đa phần là các bạn đang cố deploy hệ thống vào một lĩnh vực ngách rất đặc thù." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Kết hợp fine-tuning và RAG", summary: "Fine-tuning phù hợp cho hành vi/phong cách ổn định; RAG phù hợp cho kiến thức thay đổi. Hai cơ chế giải quyết hai nhu cầu khác nhau và có thể dùng cùng lúc.", draft: true }
  },
  {
    id: "Q10", topic: "AI Agent", difficulty: "Dễ",
    stem: "Điểm khác biệt quan trọng giữa một LLM chatbot thông thường và AI Agent là gì?",
    options: {
      A: "Agent luôn sử dụng model lớn hơn",
      B: "Agent có thể theo đuổi goal qua nhiều bước, chọn action/tool dựa trên state và observation nhận được",
      C: "Agent luôn phải có giao diện chat",
      D: "Agent không sử dụng LLM"
    },
    correct: "B",
    reference: {
      nonit: "Chatbot giống người bạn hỏi một câu rồi trả lời. Agent giống trợ lý được giao một mục tiêu: nó có thể kiểm tra thông tin, làm một bước, xem kết quả rồi quyết định tiếp theo cần làm gì.",
      dev: "Agent thêm control loop quanh LLM: state → model decision → tool/action → observation → state update → next decision.",
      dataai: "Agent có thể xem như policy thực hiện sequential decision-making dựa trên current state và observations, thay vì chỉ conditional text generation một lần."
    },
    anchors: [
      { code: "T04-073", quote: "Bây giờ chúng ta làm cho mô hình có tay, có chân, có bộ não, có thêm nhiều ngữ cảnh khác để làm được việc — đấy là con đường đi đến AI agent. Hiểu nôm na, nó không phải chỉ sinh văn bản nữa: nó có thể làm được việc, có thể tương tác với thế giới." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Chatbot và AI agent", summary: "Chatbot trả lời một lượt. Agent được giao mục tiêu, có thể gọi công cụ, quan sát kết quả rồi quyết định bước tiếp theo, lặp cho tới khi xong việc.", draft: true }
  },
  {
    id: "Q11", topic: "Agent Loop", difficulty: "Trung bình",
    stem: "Agent được giao: “Tìm lịch trống của tôi và Nam rồi đặt meeting 30 phút.” Sau khi gọi Calendar API, agent phát hiện Nam không rảnh vào thời gian dự kiến. Tại sao agent cần thay đổi plan?",
    options: {
      A: "Observation mới phải cập nhật state và ảnh hưởng đến action tiếp theo của agent",
      B: "Agent chỉ được gọi tool một lần",
      C: "Calendar phải được fine-tune vào LLM",
      D: "Agent phải xóa toàn bộ conversation"
    },
    correct: "A",
    reference: {
      nonit: "Giống như trợ lý kiểm tra lịch và phát hiện Nam bận. Nếu vẫn đặt đúng giờ cũ thì việc kiểm tra lịch chẳng còn ý nghĩa; trợ lý phải tìm phương án khác.",
      dev: "Calendar result được append thành observation trong agent state. Model turn tiếp theo consume state mới để chọn action như search slot khác hoặc ask user.",
      dataai: "Đây là closed-loop decision-making: action_t → observation_t → state_{t+1} → action_{t+1}. Observation mới thay đổi information state nên policy có thể thay đổi action."
    },
    anchors: [
      { code: "T04-073", quote: "Để làm được việc đấy, nó cần được gắn tay, gắn chân — kết nối với các công cụ, với thế giới bên ngoài." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Vòng lặp agent: quan sát cập nhật kế hoạch", summary: "Sau mỗi hành động, kết quả quan sát được cập nhật vào trạng thái và ảnh hưởng hành động kế tiếp. Agent không đi theo kịch bản cố định mà điều chỉnh theo thực tế.", draft: true }
  },
  {
    id: "Q12", topic: "Tool Calling", difficulty: "Dễ",
    stem: "User hỏi LLM: “Thời tiết Hà Nội hiện tại thế nào?” Tại sao hệ thống có weather tool nên gọi tool thay vì chỉ dựa vào model knowledge?",
    options: {
      A: "LLM không hiểu khái niệm thời tiết",
      B: "Tool có thể cung cấp dữ liệu hiện tại mà knowledge trong model không đảm bảo cập nhật",
      C: "Tool làm LLM có nhiều parameter hơn",
      D: "Tool làm context window lớn hơn"
    },
    correct: "B",
    reference: {
      nonit: "Hỏi LLM thời tiết hiện tại mà không cho nó kiểm tra nguồn mới giống như hỏi một người dựa vào bản tin họ đã xem từ trước. Tool cho AI khả năng kiểm tra tình hình hiện tại.",
      dev: "LLM nhận intent, application dispatch weather API rồi đưa tool response trở lại context. Current state được lấy từ external service thay vì model weights.",
      dataai: "Model parameters chứa learned knowledge chứ không phải guaranteed real-time state. Tool augmentation cung cấp external observation tại inference time để ground factual response."
    },
    anchors: [
      { code: "T03-034", quote: "Khi detect được người dùng hỏi đếm số lượng chữ cái trong một từ, nó chỉ cần gọi một cái tool. Tool đấy viết bằng Python luôn." },
      { code: "T06-148", quote: "Bất lợi đầu tiên là knowledge cutoff: bao giờ nó cũng có cái mốc chặn trên về mặt tri thức." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Tool calling để lấy dữ liệu hiện tại", summary: "Kiến thức trong mô hình là tĩnh và có thể cũ. Khi cần thông tin thời gian thực hoặc phép tính chính xác, hệ thống nên gọi công cụ bên ngoài rồi đưa kết quả vào ngữ cảnh.", draft: true }
  },
  {
    id: "Q13", topic: "RAG vs Agent", difficulty: "Khó",
    stem: "Hệ thống A: Question → Retrieve document → Generate answer. Hệ thống B: Request → Check CRM → (thiếu thông tin? hỏi user / check calendar) → next action. Nhận định nào đúng nhất?",
    options: {
      A: "Cả hai đều bắt buộc là Agent",
      B: "A có thể là RAG workflow cố định; B có tính agentic vì action tiếp theo phụ thuộc state và observation",
      C: "RAG luôn phức tạp hơn Agent",
      D: "Agent không thể sử dụng RAG"
    },
    correct: "B",
    reference: {
      nonit: "A giống việc luôn làm ba bước cố định: nhận câu hỏi, mở sách, trả lời. B giống trợ lý phải xem tình hình sau mỗi bước rồi mới quyết định nên làm gì tiếp.",
      dev: "A có static execution graph retrieve → generate. B có dynamic control flow, nơi tool result quyết định branch tiếp theo.",
      dataai: "RAG augment generation bằng retrieved evidence. B thể hiện sequential decision-making vì a_{t+1} phụ thuộc observation o_t, nên có agentic closed-loop behavior."
    },
    anchors: [
      { code: "T04-073", quote: "Đấy là con đường đi đến AI agent. Hiểu nôm na, nó không phải chỉ sinh văn bản nữa: nó có thể làm được việc." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Workflow cố định và hành vi agentic", summary: "Pipeline cố định (như RAG chuẩn) luôn chạy cùng một chuỗi bước. Hệ thống agentic chọn bước tiếp theo dựa trên trạng thái và kết quả vừa quan sát, nên luồng chạy có thể rẽ nhánh.", draft: true }
  },
  {
    id: "Q14", topic: "Hallucination", difficulty: "Dễ",
    stem: "LLM trả lời rất tự tin: “Theo báo cáo, doanh thu tăng 27%.” Nhưng source document không chứa con số 27%. Kết luận nào đúng?",
    options: {
      A: "Fluency và confidence trong cách diễn đạt không phải bằng chứng rằng factual claim được source hỗ trợ",
      B: "LLM chỉ hallucinate khi temperature > 1",
      C: "Model càng lớn thì không hallucinate",
      D: "Chỉ cần dùng RAG là tự động loại bỏ hallucination"
    },
    correct: "A",
    reference: {
      nonit: "AI có thể nói sai bằng giọng rất chắc chắn, giống một người nhớ nhầm nhưng vẫn nói đầy tự tin. Muốn biết 27% đúng hay không phải kiểm tra nguồn.",
      dev: "Generated output không phải source of truth. Application nên ground factual claims vào document/database/tool result và có thể thêm citation hoặc verification.",
      dataai: "LLM tối ưu likelihood của token sequences chứ không trực tiếp tối ưu truth value của từng proposition. Fluent high-probability completion vẫn có thể unsupported by evidence."
    },
    anchors: [
      { code: "T06-138", quote: "LLM có thể sai, và trên thực tế không bao giờ có chuyện đúng 100%." },
      { code: "T04-047", quote: "Nó không phải là nó biết cái tri thức đấy, mà là nó đang dự đoán những từ tiếp theo." }
    ],
    anchor_confidence: "strong",
    concept: { title: "Tự tin không phải bằng chứng", summary: "LLM có thể diễn đạt trôi chảy, chắc chắn nhưng vẫn sai. Mọi con số, sự kiện cần được kiểm tra với nguồn; không dùng giọng điệu để đánh giá độ đúng.", draft: true }
  },
  {
    id: "Q15", topic: "Prompt vs RAG vs Fine-tuning", difficulty: "Trung bình",
    stem: "Bạn muốn: (1) Model luôn trả lời ngắn gọn. (2) Model dùng handbook mới nhất. (3) Model thích nghi sâu hơn với một dạng task chuyên biệt. Mapping nào hợp lý nhất?",
    options: {
      A: "Prompt → (1), RAG → (2), Fine-tuning → (3)",
      B: "RAG → cả ba",
      C: "Fine-tuning → (1), Prompt → (2), Tokenizer → (3)",
      D: "Embedding → cả ba"
    },
    correct: "A",
    reference: {
      nonit: "Prompt giống hướng dẫn trước khi làm; RAG giống đưa tài liệu để tra; fine-tuning giống đào tạo thêm để AI quen với một công việc cụ thể.",
      dev: "Prompt thay runtime instruction, RAG inject external knowledge vào request, còn fine-tuning update model weights từ training examples.",
      dataai: "Đây tương ứng với in-context conditioning, non-parametric retrieval augmentation và parameter adaptation — ba cơ chế tác động lên model ở các lớp khác nhau."
    },
    anchors: [
      { code: "T03-119", quote: "Nếu đụng đến fine-tuning, đa phần là các bạn đang cố deploy hệ thống vào một lĩnh vực ngách rất đặc thù." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Prompt · RAG · Fine-tuning tác động ở ba lớp", summary: "Prompt điều chỉnh hành vi ngay trong lượt gọi; RAG đưa kiến thức bên ngoài vào ngữ cảnh; fine-tuning thay đổi trọng số để thích nghi sâu với một dạng việc.", draft: true }
  },
  {
    id: "Q16", topic: "Vector Database", difficulty: "Dễ",
    stem: "Trong hệ thống RAG, vector database chủ yếu làm gì?",
    options: {
      A: "Sinh câu trả lời cuối cùng",
      B: "Lưu và tìm các vector representation để retrieve những chunks gần với query theo similarity",
      C: "Fine-tune LLM",
      D: "Thay thế tokenizer"
    },
    correct: "B",
    reference: {
      nonit: "Vector database giống thư viện sắp tài liệu theo mức độ “gần nhau về ý nghĩa”. Khi bạn hỏi, hệ thống tìm những đoạn có ý gần với câu hỏi.",
      dev: "Pipeline thường là documents → chunks → embeddings → vector DB. Query cũng được embed rồi chạy nearest-neighbor search để retrieve top-k chunks.",
      dataai: "Vector DB thực hiện nearest-neighbor retrieval trong embedding space dựa trên distance/similarity giữa query và document representations, có thể kết hợp filtering/reranking."
    },
    anchors: [],
    anchor_confidence: "none",
    concept: { title: "Vector database", summary: "Nơi lưu các vector embedding của từng đoạn tài liệu và tìm nhanh những đoạn gần nhất với câu hỏi theo độ tương đồng. Nó không sinh câu trả lời và không huấn luyện mô hình.", draft: true }
  },
  {
    id: "Q17", topic: "Chunking trong RAG", difficulty: "Trung bình",
    stem: "Nếu một tài liệu 100 trang được đưa vào vector database dưới dạng một chunk duy nhất, vấn đề nào dễ xảy ra?",
    options: {
      A: "Retrieval khó xác định chính xác phần nhỏ liên quan và context đưa vào LLM có thể chứa nhiều thông tin thừa",
      B: "Embedding không thể tạo từ văn bản dài",
      C: "LLM tự động trở thành Agent",
      D: "Vector database sẽ xóa tài liệu"
    },
    correct: "A",
    reference: {
      nonit: "Giống như bạn muốn tìm một công thức nhưng hệ thống chỉ có thể đưa cho bạn cả cuốn sách 100 trang. Chia sách thành những đoạn hợp lý giúp tìm đúng phần cần đọc hơn.",
      dev: "RAG thường chạy document → chunks → embeddings → vector DB → top-k. Chunk quá lớn khiến embedding đại diện nhiều nội dung và retrieved context chứa nhiều irrelevant text.",
      dataai: "Chunk size tạo trade-off giữa retrieval granularity và semantic/context preservation. Large chunks có thể giảm discriminability và tăng context noise; quá nhỏ lại làm mất semantic dependencies."
    },
    anchors: [
      { code: "T04-052", quote: "Context rot: khi bạn càng đưa nhiều thông tin, càng đưa nhiều ngữ cảnh, thì cái mô hình càng ngày về sau nó sẽ càng kém đi." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Chunking: cắt tài liệu đúng cỡ", summary: "Tài liệu được cắt thành đoạn trước khi embed. Đoạn quá lớn khiến truy hồi kém chính xác và đưa nhiều nội dung thừa vào ngữ cảnh; quá nhỏ làm mất mạch ý.", draft: true }
  },
  {
    id: "Q18", topic: "Agent + Human Approval", difficulty: "Trung bình",
    stem: "AI Agent có thể: Đọc invoice → kiểm tra thông tin → chuẩn bị payment → chuyển 50 triệu. Vì sao bước cuối có thể vẫn cần human approval?",
    options: {
      A: "Agent không gọi được API thanh toán",
      B: "Action có hậu quả lớn hoặc khó đảo ngược nên mức autonomy phải phụ thuộc risk, không chỉ khả năng kỹ thuật của AI",
      C: "LLM không xử lý được số",
      D: "RAG không hỗ trợ payment"
    },
    correct: "B",
    reference: {
      nonit: "AI có thể chuẩn bị mọi thứ như một trợ lý kế toán, nhưng trước khi thực sự chuyển 50 triệu thì người chịu trách nhiệm vẫn nên kiểm tra và bấm xác nhận.",
      dev: "Read-only operations có thể automated, nhưng side-effecting payment API nên nằm sau approval gate hiển thị recipient, amount và payload trước dispatch.",
      dataai: "Model confidence không phải calibrated guarantee về action safety. Khi expected cost của false action cao, human-in-the-loop tạo control boundary trước irreversible action."
    },
    anchors: [
      { code: "T06-138", quote: "LLM có thể sai, và trên thực tế không bao giờ có chuyện đúng 100%." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Mức tự động hoá theo rủi ro", summary: "Hành động khó đảo ngược hoặc hậu quả lớn nên có người phê duyệt, dù AI đủ khả năng kỹ thuật. Mức tự chủ được quyết bởi chi phí khi sai, không bởi năng lực mô hình.", draft: true }
  },
  {
    id: "Q19", topic: "Model Evaluation", difficulty: "Trung bình",
    stem: "Model A có benchmark tổng quát cao hơn Model B. Nhưng trên test set đại diện cho đúng workload production của ứng dụng, Model B tốt hơn rõ rệt. Nên hiểu kết quả thế nào?",
    options: {
      A: "Luôn chọn Model A vì benchmark tổng quát cao hơn",
      B: "Evaluation trên workload đại diện cho use case thực tế quan trọng hơn việc chỉ nhìn aggregate benchmark",
      C: "Luôn chọn model nhiều parameter hơn",
      D: "Benchmark hoàn toàn không có giá trị"
    },
    correct: "B",
    reference: {
      nonit: "Một người có điểm trung bình cao nhất không có nghĩa giỏi nhất đúng môn bạn cần. Nếu công việc của bạn rất cụ thể, nên kiểm tra khả năng trên chính công việc đó.",
      dev: "Model selection nên benchmark trên representative production requests với cùng prompt, constraints và evaluation criteria. Generic leaderboard không đảm bảo application-level quality.",
      dataai: "Aggregate benchmark có thể khác target task distribution và objective. Cần estimate expected performance trên representative target distribution và xem cả metric, variance, contamination hay domain shift."
    },
    anchors: [],
    anchor_confidence: "none",
    concept: { title: "Đánh giá trên đúng workload", summary: "Điểm benchmark tổng quát không đảm bảo chất lượng cho bài toán cụ thể. Nên đo mô hình trên tập kiểm thử đại diện cho dữ liệu và yêu cầu thật của ứng dụng.", draft: true }
  },
  {
    id: "Q20", topic: "LLM + RAG + Agent", difficulty: "Khó",
    stem: "User yêu cầu: “Tìm chính sách nghỉ phép mới nhất, kiểm tra lịch của tôi tuần sau và nếu phù hợp thì tạo đơn nghỉ.” Architecture nào hợp lý nhất?",
    options: {
      A: "Chỉ sử dụng LLM",
      B: "Chỉ sử dụng vector database",
      C: "Agent điều phối workflow, dùng RAG để lấy chính sách mới nhất và dùng tool/API để kiểm tra lịch cũng như tạo đơn",
      D: "Chỉ fine-tune model"
    },
    correct: "C",
    reference: {
      nonit: "Agent giống người trợ lý điều phối công việc: nó tra sổ chính sách mới nhất, xem lịch của bạn rồi mới tạo đơn. Mỗi thành phần AI đảm nhiệm một phần khác nhau.",
      dev: "User → Agent/LLM → RAG(policy) → Calendar API → Leave API. Agent quản lý control flow, RAG cung cấp knowledge và APIs cung cấp external state/action.",
      dataai: "Đây là retrieval-augmented agentic system. Retrieval cung cấp external evidence, tool observations cập nhật state, còn agent policy quyết định action tiếp theo cho tới completion condition."
    },
    anchors: [
      { code: "T04-073", quote: "Nó cần được gắn tay, gắn chân — kết nối với các công cụ, với thế giới bên ngoài." },
      { code: "T03-036", quote: "Dùng RAG cho một vài cái system nó tốt." }
    ],
    anchor_confidence: "partial",
    concept: { title: "Ghép LLM, RAG và agent", summary: "Agent điều phối các bước, RAG cung cấp kiến thức cập nhật, công cụ/API cung cấp trạng thái và hành động bên ngoài. Mỗi thành phần giải quyết một phần của yêu cầu phức tạp.", draft: true }
  }
];
