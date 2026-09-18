/* Imported from the supplied AI-track quiz. Dev outer contract is preserved. Matching/ordering items are represented as single-choice complete mapping/sequence sets so every visible option is a complete answer and exactly one is correct. Anchors are empty because no transcript citation was verified. */
window.QUESTION_BANK = [
  {
    "id": "Q01",
    "topic": "fair model comparison",
    "difficulty": "Trung bình",
    "question_type": "multi_select",
    "stem": "Chọn tất cả confound (biến nhiễu) phải sửa khi so sánh hai model.\n\nBối cảnh: Model A dùng prompt tiếng Việt, temperature 0 và latency tính cả setup client; Model B dùng prompt tiếng Anh ngắn hơn, temperature 1 và latency không tính setup client; mỗi model chạy một lần.",
    "options": {
      "A": "Prompt/language khác nhau",
      "B": "Temperature khác nhau",
      "C": "Measurement boundary latency khác nhau",
      "D": "Chỉ một run nên variability chưa được đo",
      "E": "Hai model có identity khác nhau"
    },
    "correct": "A, B, C, D",
    "reference": {
      "nonit": "Hãy hình dung một cuộc thi: muốn biết model nào tốt hơn, phải giữ cách ra đề, nhiệt độ và cách bấm giờ giống nhau; chạy một lần cũng chưa cho biết độ ổn định.",
      "dev": "Trong benchmark, model identity là biến độc lập. Prompt/language, temperature, latency boundary và số lần chạy phải được kiểm soát để tránh confounding.",
      "dataai": "Model identity là treatment; prompt, temperature và measurement boundary là nuisance factors cần giữ cố định, còn một run không đủ ước lượng variance."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "fair model comparison",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q02",
    "topic": "secret management",
    "difficulty": "Trung bình",
    "question_type": "multi_select",
    "stem": "Chọn tất cả vấn đề hoặc hành động đúng.\n\nBối cảnh: app.py hard-code API_KEY; .env đã commit; .env.example chỉ chứa API_KEY=; code đọc os.environ['API_KEY'].",
    "options": {
      "A": "Xóa secret hard-code khỏi app.py",
      "B": "In API key vào log để debug",
      "C": "Giữ .env.example không có giá trị thật",
      "D": "Báo lỗi cấu hình rõ trước network call khi thiếu biến môi trường",
      "E": "Bỏ theo dõi .env và thêm vào .gitignore"
    },
    "correct": "A, C, D, E",
    "reference": {
      "nonit": "Đừng để chìa khóa trong mã nguồn, nhật ký hay kho chung. File mẫu chỉ ghi tên ngăn kéo; ứng dụng cần báo rõ nếu chưa có chìa khóa trước khi gọi mạng.",
      "dev": "Remove hard-coded/committed secrets, ignore .env, keep .env.example value-free, and fail fast before the network call when API_KEY is absent.",
      "dataai": "Secret exposure is a configuration and supply-chain risk. Separate secret material from code/version control and validate required environment variables before side effects."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "secret management",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q03",
    "topic": "LLM API contract",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Call nào khớp contract client.chat.create(model, messages, temperature, max_output_tokens)?",
    "options": {
      "A": "Dùng prompt, system và max_tokens",
      "B": "Gộp system/user; đảo temperature và output cap",
      "C": "messages có role system và user; temperature=0.2; max_output_tokens=200",
      "D": "Gọi client.responses.delete"
    },
    "correct": "C",
    "reference": {
      "nonit": "Lựa chọn C tách người hướng dẫn và câu hỏi thành hai vai trò, đồng thời dùng đúng giới hạn nhiệt độ và đầu ra.",
      "dev": "C matches the declared method and parameter contract: model, role-separated messages, temperature, and max_output_tokens.",
      "dataai": "C preserves the semantic fields and typed role structure while assigning the specified sampling and output-cap values."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "LLM API contract",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q04",
    "topic": "finish reason",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép finish reason giả định với xử lý trực tiếp phù hợp.",
    "options": {
      "A": "stop → Trả về kết quả hoàn chỉnh bình thường; length → Cảnh báo hoặc gọi tiếp để sinh thêm token do bị giới hạn độ dài; tool_calls / function_call → Chuyển giao thực thi cho hàm/tool handler",
      "B": "stop → Cảnh báo hoặc gọi tiếp; length → Chuyển giao cho tool handler; tool_calls / function_call → Trả về kết quả hoàn chỉnh bình thường",
      "C": "stop → Chuyển giao cho tool handler; length → Trả về kết quả hoàn chỉnh bình thường; tool_calls / function_call → Cảnh báo hoặc gọi tiếp",
      "D": "stop → Trả về kết quả hoàn chỉnh bình thường; length → Chuyển giao cho tool handler; tool_calls / function_call → Cảnh báo hoặc gọi tiếp"
    },
    "correct": "A",
    "reference": {
      "nonit": "Finish metadata cho biết lý do quá trình sinh kết thúc: dừng tự nhiên, bị giới hạn độ dài hoặc yêu cầu gọi công cụ. Vì vậy không nên chỉ dựa vào phần text để quyết định bước xử lý tiếp theo.",
      "dev": "Finish metadata cho biết lý do quá trình sinh kết thúc: dừng tự nhiên, bị giới hạn độ dài hoặc yêu cầu gọi công cụ. Vì vậy không nên chỉ dựa vào phần text để quyết định bước xử lý tiếp theo.",
      "dataai": "Finish metadata cho biết lý do quá trình sinh kết thúc: dừng tự nhiên, bị giới hạn độ dài hoặc yêu cầu gọi công cụ. Vì vậy không nên chỉ dựa vào phần text để quyết định bước xử lý tiếp theo."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "finish reason",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q05",
    "topic": "API latency",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Với non-streaming request, code nào đo raw API call latency đúng boundary nhất?",
    "options": {
      "A": "Gọi API rồi mới start timer",
      "B": "Start timer ngay trước call, dừng ngay sau call",
      "C": "Đo cả load dữ liệu và render",
      "D": "Dùng total_tokens làm latency"
    },
    "correct": "B",
    "reference": {
      "nonit": "Timer phải bắt đầu ngay trước API call và kết thúc ngay sau khi call hoàn thành. Nếu đưa load dữ liệu hoặc render vào khoảng đo thì không còn đo riêng raw API latency.",
      "dev": "Timer phải bắt đầu ngay trước API call và kết thúc ngay sau khi call hoàn thành. Nếu đưa load dữ liệu hoặc render vào khoảng đo thì không còn đo riêng raw API latency.",
      "dataai": "Timer phải bắt đầu ngay trước API call và kết thúc ngay sau khi call hoàn thành. Nếu đưa load dữ liệu hoặc render vào khoảng đo thì không còn đo riêng raw API latency."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "API latency",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q06",
    "topic": "provider API mapping",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép semantic field tương đương giữa Provider A và B.",
    "options": {
      "A": "model → model_id; messages[role=system].content → system; messages[role=user].content → input",
      "B": "model → system; messages[role=system].content → input; messages[role=user].content → model_id",
      "C": "model → input; messages[role=system].content → model_id; messages[role=user].content → system",
      "D": "model → model_id; messages[role=system].content → input; messages[role=user].content → system"
    },
    "correct": "A",
    "reference": {
      "nonit": "Hai provider có thể sử dụng container format khác nhau nhưng các trường vẫn có thể được ánh xạ theo cùng ý nghĩa: model identifier, system instruction và user input.",
      "dev": "Hai provider có thể sử dụng container format khác nhau nhưng các trường vẫn có thể được ánh xạ theo cùng ý nghĩa: model identifier, system instruction và user input.",
      "dataai": "Hai provider có thể sử dụng container format khác nhau nhưng các trường vẫn có thể được ánh xạ theo cùng ý nghĩa: model identifier, system instruction và user input."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "provider API mapping",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q07",
    "topic": "temperature",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ứng dụng cần tạo mã phân loại ổn định giữa các lần chạy. Cấu hình nào phù hợp hơn?",
    "options": {
      "A": "Temperature thấp",
      "B": "Không giới hạn output và tăng temperature",
      "C": "Temperature rất cao",
      "D": "Đổi temperature ngẫu nhiên mỗi request"
    },
    "correct": "A",
    "reference": {
      "nonit": "Nhiệt độ thấp giống như yêu cầu người trả lời bám sát một mẫu cố định hơn; nó giảm ngẫu nhiên nhưng không hứa chắc mọi lần giống hệt.",
      "dev": "Lower temperature reduces sampling variance for a classification-format path, but determinism still depends on provider/runtime controls.",
      "dataai": "Lower temperature concentrates the sampling distribution, improving repeatability under otherwise fixed conditions; it is not an absolute determinism guarantee."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "temperature",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q08",
    "topic": "attention",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép thành phần attention với vai trò khái niệm tương ứng.",
    "options": {
      "A": "Queries (Q) và Keys (K) → Tương tác để tính compatibility scores/attention weights; Values (V) → Chứa thông tin nội dung được tổng hợp theo trọng số attention",
      "B": "Queries (Q) và Keys (K) → Chứa nội dung được tổng hợp; Values (V) → Tính compatibility scores/attention weights",
      "C": "Queries (Q) và Keys (K) → Chỉ lưu token đầu vào; Values (V) → Tạo causal mask",
      "D": "Queries (Q) và Keys (K) → Tạo output cuối trực tiếp; Values (V) → Tính độ tương thích giữa vị trí"
    },
    "correct": "A",
    "reference": {
      "nonit": "Q và K được dùng để xác định mức liên quan giữa các vị trí. Sau khi chuẩn hóa thành attention weights, các trọng số này được sử dụng để tổng hợp thông tin từ V.",
      "dev": "Q và K được dùng để xác định mức liên quan giữa các vị trí. Sau khi chuẩn hóa thành attention weights, các trọng số này được sử dụng để tổng hợp thông tin từ V.",
      "dataai": "Q và K được dùng để xác định mức liên quan giữa các vị trí. Sau khi chuẩn hóa thành attention weights, các trọng số này được sử dụng để tổng hợp thông tin từ V."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "attention",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q09",
    "topic": "Transformer Post-Norm",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Theo quy ước Post-Norm rút gọn, hãy sắp xếp trình tự luồng xử lý chính trong một Transformer block.",
    "options": {
      "A": "Multi-Head Self-Attention → Residual Add & LayerNorm → Feed-Forward Network → Residual Add & LayerNorm",
      "B": "Multi-Head Self-Attention → Feed-Forward Network → Residual Add & LayerNorm → Residual Add & LayerNorm",
      "C": "Residual Add & LayerNorm → Multi-Head Self-Attention → Residual Add & LayerNorm → Feed-Forward Network",
      "D": "Feed-Forward Network → Residual Add & LayerNorm → Multi-Head Self-Attention → Residual Add & LayerNorm"
    },
    "correct": "A",
    "reference": {
      "nonit": "Trong Transformer Post-Norm, mỗi sublayer được thực hiện trước, sau đó output của sublayer được cộng với residual connection rồi mới LayerNorm. Quy trình này diễn ra cho attention và sau đó cho FFN.",
      "dev": "Trong Transformer Post-Norm, mỗi sublayer được thực hiện trước, sau đó output của sublayer được cộng với residual connection rồi mới LayerNorm. Quy trình này diễn ra cho attention và sau đó cho FFN.",
      "dataai": "Trong Transformer Post-Norm, mỗi sublayer được thực hiện trước, sau đó output của sublayer được cộng với residual connection rồi mới LayerNorm. Quy trình này diễn ra cho attention và sau đó cho FFN."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "Transformer Post-Norm",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q10",
    "topic": "encoder-decoder attention",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép attention path với nguồn thông tin mà nó truy cập trong kiến trúc Transformer encoder–decoder chuẩn.",
    "options": {
      "A": "Encoder self-attention → Các source positions trong encoder input; Decoder causal self-attention → Các target positions hiện tại/quá khứ được causal mask cho phép; Decoder cross-attention → Encoder outputs",
      "B": "Encoder self-attention → Encoder outputs; Decoder causal self-attention → Các source positions; Decoder cross-attention → Target positions tương lai",
      "C": "Encoder self-attention → Target positions; Decoder causal self-attention → Encoder outputs; Decoder cross-attention → Source positions chưa mã hóa",
      "D": "Encoder self-attention → Các target positions; Decoder causal self-attention → Các target positions tương lai; Decoder cross-attention → Chính nó"
    },
    "correct": "A",
    "reference": {
      "nonit": "Encoder self-attention xử lý các vị trí của source sequence. Decoder causal self-attention không được nhìn các target token tương lai. Cross-attention cho phép decoder truy cập biểu diễn do encoder tạo ra.",
      "dev": "Encoder self-attention xử lý các vị trí của source sequence. Decoder causal self-attention không được nhìn các target token tương lai. Cross-attention cho phép decoder truy cập biểu diễn do encoder tạo ra.",
      "dataai": "Encoder self-attention xử lý các vị trí của source sequence. Decoder causal self-attention không được nhìn các target token tương lai. Cross-attention cho phép decoder truy cập biểu diễn do encoder tạo ra."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "encoder-decoder attention",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q11",
    "topic": "LLM training stages",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép thay đổi kỹ thuật với trục cải tiến phù hợp nhất đối với mô hình ngôn ngữ.",
    "options": {
      "A": "Tăng corpus và compute cho next-token training → Pre-training; Instruction/preference tuning (SFT/RLHF) sau base model → Post-training; Giữ nguyên weights, dùng nhiều bước reasoning/search khi trả lời → Test-time compute",
      "B": "Tăng corpus và compute cho next-token training → Post-training; Instruction/preference tuning sau base model → Test-time compute; Reasoning/search khi trả lời → Pre-training",
      "C": "Tăng corpus và compute → Test-time compute; SFT/RLHF → Pre-training; Reasoning/search → Post-training",
      "D": "Cả ba thay đổi đều là fine-tuning vì đều cải thiện chất lượng model"
    },
    "correct": "A",
    "reference": {
      "nonit": "Pre-training xây dựng base model; post-training điều chỉnh hành vi sau khi đã có base model; test-time compute tăng lượng xử lý tại inference mà không cần thay đổi weights.",
      "dev": "Pre-training xây dựng base model; post-training điều chỉnh hành vi sau khi đã có base model; test-time compute tăng lượng xử lý tại inference mà không cần thay đổi weights.",
      "dataai": "Pre-training xây dựng base model; post-training điều chỉnh hành vi sau khi đã có base model; test-time compute tăng lượng xử lý tại inference mà không cần thay đổi weights."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "LLM training stages",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q12",
    "topic": "model selection",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Tier nào phù hợp nhất: input 90k token, output cap 8k, reasoning vừa, budget hạn chế?\n\nBối cảnh: Tier S: 32k context, rẻ/nhanh; Tier M: 128k context, reasoning tốt, giá vừa; Tier L: reasoning mạnh nhất, đắt/chậm.",
    "options": {
      "A": "Tier S",
      "B": "Tier M",
      "C": "Tier L",
      "D": "Không tier nào"
    },
    "correct": "B",
    "reference": {
      "nonit": "Tier S không đủ context cho input 90k. Tier M có context 128k, reasoning phù hợp và chi phí thấp hơn Tier L. Theo profile giả định của đề, M là lựa chọn phù hợp nhất.",
      "dev": "Tier S không đủ context cho input 90k. Tier M có context 128k, reasoning phù hợp và chi phí thấp hơn Tier L. Theo profile giả định của đề, M là lựa chọn phù hợp nhất.",
      "dataai": "Tier S không đủ context cho input 90k. Tier M có context 128k, reasoning phù hợp và chi phí thấp hơn Tier L. Theo profile giả định của đề, M là lựa chọn phù hợp nhất."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "model selection",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q13",
    "topic": "agentic systems",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ứng dụng nhận mục tiêu đặt lịch họp, kiểm tra lịch bốn người, đề xuất giờ, gửi lời mời qua tool và kiểm tra trạng thái. Hành vi nào mô tả đúng nhất?",
    "options": {
      "A": "Discriminative",
      "B": "Chỉ là database query",
      "C": "Agentic",
      "D": "Chỉ generative"
    },
    "correct": "C",
    "reference": {
      "nonit": "Hệ thống nhận một mục tiêu và thực hiện nhiều bước, tương tác với tool và kiểm tra kết quả để hoàn thành mục tiêu. Vì vậy hành vi chính được mô tả là agentic.",
      "dev": "Hệ thống nhận một mục tiêu và thực hiện nhiều bước, tương tác với tool và kiểm tra kết quả để hoàn thành mục tiêu. Vì vậy hành vi chính được mô tả là agentic.",
      "dataai": "Hệ thống nhận một mục tiêu và thực hiện nhiều bước, tương tác với tool và kiểm tra kết quả để hoàn thành mục tiêu. Vì vậy hành vi chính được mô tả là agentic."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "agentic systems",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q14",
    "topic": "problem discovery",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Stakeholder nói: “Hãy làm chatbot AI cho phòng nhân sự.” Câu viết lại nào là điểm bắt đầu discovery tốt nhất?",
    "options": {
      "A": "Chatbot AI sẽ giảm 70% công việc HR",
      "B": "Nhân viên mới kẹt ở bước nào khi tìm policy, hậu quả và outcome là gì?",
      "C": "Cần RAG và vector database cho mọi tài liệu HR",
      "D": "Dùng model lớn nhất"
    },
    "correct": "B",
    "reference": {
      "nonit": "Yêu cầu ban đầu chỉ nêu giải pháp. Discovery phải khôi phục actor, workflow, pain, outcome và vẫn để mở phương án không AI.",
      "dev": "Yêu cầu ban đầu chỉ nêu giải pháp. Discovery phải khôi phục actor, workflow, pain, outcome và vẫn để mở phương án không AI.",
      "dataai": "Yêu cầu ban đầu chỉ nêu giải pháp. Discovery phải khôi phục actor, workflow, pain, outcome và vẫn để mở phương án không AI."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "problem discovery",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q15",
    "topic": "product iteration",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép từng feedback sau test với bước sớm nhất cần quay lại.",
    "options": {
      "A": "Người dùng không gặp pain mà nhóm đã giả định → Define lại problem; Pain đúng nhưng họ cần cảnh báo theo nhóm thay vì từng cá nhân → Ideate lại cách giải; Luồng ý tưởng đúng nhưng nút xác nhận khiến họ gửi nhầm → Prototype/interaction",
      "B": "Người dùng không gặp pain → Prototype; Pain đúng nhưng cách cảnh báo sai → Define problem; Nút xác nhận gây gửi nhầm → Pre-training",
      "C": "Người dùng không gặp pain → Ideate; Pain đúng nhưng cách cảnh báo sai → Prototype; Nút xác nhận gây gửi nhầm → Define problem",
      "D": "Cả ba feedback đều quay lại Define problem vì mọi lỗi sản phẩm đều bắt đầu từ problem"
    },
    "correct": "A",
    "reference": {
      "nonit": "Không có nhu cầu thì quay về problem; nhu cầu đúng nhưng cách giải sai thì quay về ideate; ma sát tương tác thì quay về prototype.",
      "dev": "Không có nhu cầu thì quay về problem; nhu cầu đúng nhưng cách giải sai thì quay về ideate; ma sát tương tác thì quay về prototype.",
      "dataai": "Không có nhu cầu thì quay về problem; nhu cầu đúng nhưng cách giải sai thì quay về ideate; ma sát tương tác thì quay về prototype."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "product iteration",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q16",
    "topic": "AI system design",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Ghép từng yêu cầu với cơ chế chịu trách nhiệm trực tiếp nhất.",
    "options": {
      "A": "Diễn giải email tự do → LLM; Tính thuế theo công thức → Function deterministic; Lấy chính sách nội bộ mới nhất → Retrieval; Tìm tuyến giao hàng tối ưu → Optimizer/graph; Gửi lệnh đặt lịch → External tool/action",
      "B": "Diễn giải email tự do → Function deterministic; Tính thuế theo công thức → LLM; Lấy chính sách mới nhất → Optimizer/graph; Tìm tuyến → Retrieval; Gửi lệnh → LLM",
      "C": "Diễn giải email tự do → Retrieval; Tính thuế → External tool/action; Lấy chính sách → LLM; Tìm tuyến → Function deterministic; Gửi lệnh → Optimizer/graph",
      "D": "Tất cả yêu cầu đều giao cho LLM để giảm số thành phần hệ thống"
    },
    "correct": "A",
    "reference": {
      "nonit": "Mỗi requirement có failure mode và cơ chế phù hợp; LLM không nên giả lập tính toán, freshness hay side effect.",
      "dev": "Mỗi requirement có failure mode và cơ chế phù hợp; LLM không nên giả lập tính toán, freshness hay side effect.",
      "dataai": "Mỗi requirement có failure mode và cơ chế phù hợp; LLM không nên giả lập tính toán, freshness hay side effect."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "AI system design",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q17",
    "topic": "parallel workflows",
    "difficulty": "Trung bình",
    "question_type": "multi_select",
    "stem": "Chọn tất cả thiết kế đúng cho ba phân tích độc lập Finance, Legal và Customer feedback, chỉ tổng hợp sau khi các nhánh hoàn tất.",
    "options": {
      "A": "Legal dùng kết quả Finance chưa hoàn thành nhưng vẫn gọi là song song",
      "B": "Chạy ba phân tích song song nếu cùng nhận input đã chuẩn hóa",
      "C": "Định nghĩa schema output chung cho aggregator",
      "D": "Fan-out luôn giảm tổng token cost",
      "E": "Quy định xử lý khi một nhánh timeout"
    },
    "correct": "B, C, E",
    "reference": {
      "nonit": "Parallel branches phải độc lập, có contract và partial-failure policy; fan-out thường tăng tổng work/cost.",
      "dev": "Parallel branches phải độc lập, có contract và partial-failure policy; fan-out thường tăng tổng work/cost.",
      "dataai": "Parallel branches phải độc lập, có contract và partial-failure policy; fan-out thường tăng tổng work/cost."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "parallel workflows",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q18",
    "topic": "graceful failure",
    "difficulty": "Trung bình",
    "question_type": "multi_select",
    "stem": "Retrieval bị lỗi nhưng dữ liệu form người dùng đã nhập vẫn còn. Chọn tất cả phản hồi graceful failure phù hợp.",
    "options": {
      "A": "Xóa toàn bộ form để reset",
      "B": "Dùng cache cũ nhưng gọi là mới",
      "C": "Giữ form và nói rõ chưa lấy được nguồn",
      "D": "Chuyển review thủ công nếu quyết định gấp",
      "E": "Cho retry retrieval hoặc lưu nháp"
    },
    "correct": "C, D, E",
    "reference": {
      "nonit": "Failure được cô lập ở retrieval; user giữ work và có retry/save/handoff.",
      "dev": "Failure được cô lập ở retrieval; user giữ work và có retry/save/handoff.",
      "dataai": "Failure được cô lập ở retrieval; user giữ work và có retry/save/handoff."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "graceful failure",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q19",
    "topic": "operational design domain",
    "difficulty": "Trung bình",
    "question_type": "single_choice",
    "stem": "Camera chỉ được validation ban ngày; ban đêm lux dưới ngưỡng. Hành động phù hợp nhất là gì?",
    "options": {
      "A": "Coi ban đêm là edge case đã đạt",
      "B": "Tăng temperature",
      "C": "Ngoài ODD: giảm chức năng hoặc bàn giao theo policy",
      "D": "Tiếp tục tự động và bỏ cảnh báo"
    },
    "correct": "C",
    "reference": {
      "nonit": "Lux dưới phạm vi validation là out-of-ODD; hệ thống phải degrade/stop/handoff.",
      "dev": "Lux dưới phạm vi validation là out-of-ODD; hệ thống phải degrade/stop/handoff.",
      "dataai": "Lux dưới phạm vi validation là out-of-ODD; hệ thống phải degrade/stop/handoff."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "operational design domain",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  },
  {
    "id": "Q20",
    "topic": "clinical AI evaluation",
    "difficulty": "Trung bình",
    "question_type": "multi_select",
    "stem": "Hệ thống cảnh báo sepsis có human triage; bỏ sót ca bệnh nguy hiểm hơn cảnh báo giả. Chọn tất cả phát biểu phù hợp.",
    "options": {
      "A": "Recall 100% luôn là cấu hình production đúng",
      "B": "Threshold cuối phải test trong workflow triage thật",
      "C": "Có lý do ưu tiên recall cao hơn",
      "D": "Precision không còn cần đo",
      "E": "False negative là lỗi cần theo dõi chặt"
    },
    "correct": "B, C, E",
    "reference": {
      "nonit": "Chi phí false negative cao ủng hộ việc ưu tiên recall, nhưng precision và burden của triage vẫn phải đo; không có cấu hình tuyệt đối.",
      "dev": "Chi phí false negative cao ủng hộ việc ưu tiên recall, nhưng precision và burden của triage vẫn phải đo; không có cấu hình tuyệt đối.",
      "dataai": "Chi phí false negative cao ủng hộ việc ưu tiên recall, nhưng precision và burden của triage vẫn phải đo; không có cấu hình tuyệt đối."
    },
    "anchors": [],
    "anchor_confidence": "none",
    "concept": {
      "title": "clinical AI evaluation",
      "summary": "Nội dung quiz được tích hợp từ bộ câu hỏi AI track; chưa gắn với đoạn transcript cụ thể.",
      "draft": false
    }
  }
];
